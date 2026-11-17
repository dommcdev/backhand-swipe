import type {
  Category,
  ClosestCall,
  Fighter,
  Matchup,
  RankedFighter,
  Rankings,
  RankingsRequest,
  VoteRequest,
} from '../src/api/types'
import { winChance } from '../src/lib/elo'
import { EXPLORE, fitRatings, gaussian, kFactor, opponentSpread, uncertainty, weightedPick, type Tally } from './ratings'

// D1 bills per row read. Every request here reads a small, fixed number of rows through an index,
// however many fighters and votes there are. Anything that has to look at everything runs in the
// hourly or nightly cron instead (see the bottom of this file).

type Row = Record<string, unknown>

export const categories: Category[] = ['people', 'fictional', 'animals', 'objects']
/** A head-to-head needs this many votes before it can show up as a closest call. Matches pair_contested_idx. */
const CLOSEST_CALL_MIN_VOTES = 5
const RANKINGS_PAGE = 50

export class BadRequest extends Error {}

const toFighter = (row: Row): Fighter => ({
  id: row.fighter_id as string,
  name: row.name as string,
  shortName: row.short_name as string,
  category: row.category as Category,
  count: row.quantity as number,
  emoji: (row.emoji as string | null) ?? undefined,
  imageUrl: (row.image_url as string | null) ?? undefined,
  weightKg: row.weight_kg as number,
  heightCm: (row.height_cm as number | null) ?? undefined,
  age: (row.age as number | null) ?? undefined,
  secretWeapon: row.secret_weapon as string,
  weakness: row.weakness as string,
})

const toRanked = (row: Row, rank: number, lastRank: unknown): RankedFighter => ({
  ...toFighter(row),
  elo: row.elo as number,
  wins: row.wins as number,
  losses: row.losses as number,
  rank,
  rankChange: typeof lastRank === 'number' ? lastRank - rank : 0,
})

const pairId = (a: string, b: string) => (a < b ? `${a}~${b}` : `${b}~${a}`)

// ---------------------------------------------------------------------------------------------
// Matchups

type Candidate = { id: string; elo: number; games: number }
const CANDIDATE_SQL = 'SELECT fighter_id, elo, wins + losses AS games FROM fighter'
const toCandidate = (r: Row): Candidate => ({ id: r.fighter_id as string, elo: r.elo as number, games: r.games as number })

/** How many fighters with the fewest votes to consider each time. */
const FRESH_POOL = 40
/** Share of matchups built around one of the fighters with the fewest votes. */
const FRESH_SHARE = 0.6
/** How many fighters on each side of the target rating to choose an opponent from. */
const NEIGHBORS = 4

/** The highest fighter rowid, for picking random fighters. It only changes on import, so it is kept for a while. */
let rowidCache: { at: number; max: Promise<number> } | undefined
function maxRowid(db: D1Database): Promise<number> {
  if (rowidCache && Date.now() - rowidCache.at < 10 * 60_000) return rowidCache.max
  const max = db
    .prepare('SELECT coalesce(max(rowid), 0) AS n FROM fighter')
    .first<Row>()
    .then((r) => (r?.n as number) ?? 0)
  rowidCache = { at: Date.now(), max }
  max.catch(() => (rowidCache = undefined))
  return max
}

/** A random fighter: the first one at or after a random rowid. One row read. */
const randomFighter = (db: D1Database, max: number) =>
  db.prepare(`${CANDIDATE_SQL} WHERE rowid >= ?1 ORDER BY rowid LIMIT 1`).bind(1 + Math.floor(Math.random() * max))

export async function getMatchups(db: D1Database, count: number): Promise<Matchup[]> {
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new BadRequest('count must be from 1 to 20')
  const max = await maxRowid(db)
  if (max === 0) return []

  // 1. Fighters with the fewest votes, plus some random ones.
  const [freshResult, ...randomResults] = await db.batch<Row>([
    db.prepare(`${CANDIDATE_SQL} ORDER BY wins + losses LIMIT ?1`).bind(FRESH_POOL),
    ...Array.from({ length: count * 2 }, () => randomFighter(db, max)),
  ])
  const fresh = freshResult.results.map(toCandidate)
  const random = randomResults.flatMap((r) => r.results.map(toCandidate))

  // A fighter appears at most once per batch while there are enough to go around.
  const used = new Set<string>()
  const unused = (list: Candidate[], not?: Candidate) => list.filter((c) => !used.has(c.id) && c.id !== not?.id)

  const leads: Candidate[] = []
  for (let i = 0; i < count; i++) {
    const pool = Math.random() < FRESH_SHARE ? unused(fresh) : []
    const lead =
      weightedPick(pool, (c) => uncertainty(c.games)) ?? weightedPick(unused(random), () => 1) ?? weightedPick(unused(fresh), () => 1)
    if (!lead) break
    used.add(lead.id)
    leads.push(lead)
  }

  // 2. An opponent for each: usually someone rated near a target close to the lead's rating, so
  // the result is hard to call. Unsure fighters look further afield.
  const plans = leads.map((lead) => {
    const explore = Math.random() < EXPLORE
    const target = lead.elo + gaussian() * opponentSpread(lead.games)
    return { lead, explore, target }
  })
  const near = await db.batch<Row>(
    plans
      .filter((p) => !p.explore)
      .flatMap((p) => [
        db.prepare(`${CANDIDATE_SQL} WHERE elo >= ?1 ORDER BY elo LIMIT ?2`).bind(Math.round(p.target), NEIGHBORS),
        db.prepare(`${CANDIDATE_SQL} WHERE elo < ?1 ORDER BY elo DESC LIMIT ?2`).bind(Math.round(p.target), NEIGHBORS),
      ]),
  )

  const pairs: [string, string][] = []
  const seenPairs = new Set<string>()
  let nearIndex = 0
  for (const { lead, explore } of plans) {
    let options = random
    if (!explore) {
      options = [...near[nearIndex].results, ...near[nearIndex + 1].results].map(toCandidate)
      nearIndex += 2
    }
    const opponent =
      weightedPick(unused(options, lead), (c) => 0.25 + uncertainty(c.games)) ??
      weightedPick(unused(random, lead), () => 1) ??
      weightedPick(
        [...options, ...random, ...fresh].filter((c) => c.id !== lead.id),
        () => 1,
      )
    if (!opponent) continue
    const id = pairId(lead.id, opponent.id)
    if (seenPairs.has(id)) continue
    seenPairs.add(id)
    used.add(opponent.id)
    pairs.push(lead.id < opponent.id ? [lead.id, opponent.id] : [opponent.id, lead.id])
  }
  if (pairs.length === 0) return []

  // 3. The chosen fighters' details and the head-to-head so far.
  const ids = [...new Set(pairs.flat())]
  const [fighterRows, tallyRows] = await db.batch<Row>([
    db.prepare('SELECT * FROM fighter WHERE fighter_id IN (SELECT value FROM json_each(?1))').bind(JSON.stringify(ids)),
    db
      .prepare(
        `SELECT p.fighter_a_id, p.fighter_b_id, p.a_wins, p.b_wins
         FROM json_each(?1) j
         CROSS JOIN pair p ON p.fighter_a_id = j.value ->> '$[0]' AND p.fighter_b_id = j.value ->> '$[1]'`,
      )
      .bind(JSON.stringify(pairs)),
  ])
  const fighters = new Map(fighterRows.results.map((r) => [r.fighter_id as string, toFighter(r)]))
  const tallies = new Map(tallyRows.results.map((r) => [pairId(r.fighter_a_id as string, r.fighter_b_id as string), r]))

  return pairs.flatMap(([a, b]) => {
    const fa = fighters.get(a)
    const fb = fighters.get(b)
    if (!fa || !fb) return []
    const t = tallies.get(pairId(a, b))
    const aVotes = (t?.a_wins as number) ?? 0
    const bVotes = (t?.b_wins as number) ?? 0
    const flip = Math.random() < 0.5
    return [
      {
        id: pairId(a, b),
        left: flip ? fb : fa,
        right: flip ? fa : fb,
        leftVotes: flip ? bVotes : aVotes,
        rightVotes: flip ? aVotes : bVotes,
      },
    ]
  })
}

// ---------------------------------------------------------------------------------------------
// Votes

const isVoteRequest = (body: unknown): body is VoteRequest =>
  typeof body === 'object' &&
  body !== null &&
  'matchupId' in body &&
  typeof body.matchupId === 'string' &&
  'winnerId' in body &&
  typeof body.winnerId === 'string'

export async function vote(db: D1Database, body: unknown) {
  if (!isVoteRequest(body)) throw new BadRequest('Expected { matchupId: string, winnerId: string }')
  const { matchupId, winnerId } = body
  const [a, b, extra] = matchupId.split('~')
  if (!a || !b || extra !== undefined || a >= b || (winnerId !== a && winnerId !== b)) {
    throw new BadRequest(`${winnerId} is not in matchup ${matchupId}`)
  }

  const { results } = await db
    .prepare(`${CANDIDATE_SQL} WHERE fighter_id IN (?1, ?2)`)
    .bind(a, b)
    .run<Row>()
  const fa = results.map(toCandidate).find((c) => c.id === a)
  const fb = results.map(toCandidate).find((c) => c.id === b)
  if (!fa || !fb) throw new BadRequest(`Unknown matchup ${matchupId}`)

  const aWon = winnerId === a ? 1 : 0
  const surprise = aWon - winChance(fa.elo, fb.elo)
  // Fighters with few votes move further, so they reach their real rating quickly.
  const aDelta = Math.round(kFactor(fa.games) * surprise)
  const bDelta = Math.round(kFactor(fb.games) * surprise)

  // The ratings were read before this write so votes never wait on each other. Every update is an
  // increment, so a vote that lands in between is never lost. A batch runs as one transaction.
  const addResult = db.prepare('UPDATE fighter SET elo = elo + ?1, wins = wins + ?2, losses = losses + ?3 WHERE fighter_id = ?4')
  await db.batch([
    db.prepare('INSERT INTO vote (fighter_a_id, fighter_b_id, winner_id) VALUES (?1, ?2, ?3)').bind(a, b, winnerId),
    db
      .prepare(
        `INSERT INTO pair (fighter_a_id, fighter_b_id, a_wins, b_wins) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT DO UPDATE SET a_wins = a_wins + excluded.a_wins, b_wins = b_wins + excluded.b_wins`,
      )
      .bind(a, b, aWon, 1 - aWon),
    addResult.bind(aDelta, aWon, 1 - aWon, a),
    addResult.bind(-bDelta, 1 - aWon, aWon, b),
  ])
}

// ---------------------------------------------------------------------------------------------
// Rankings

/** The snapshot "This week" compares against: the oldest one from the last 7 days. */
const LAST_WEEK = `(SELECT min(snapshot_date) FROM fighter_rating_snapshot WHERE snapshot_date >= date('now', '-7 days'))`

export async function getRankings(db: D1Database, request: RankingsRequest): Promise<Rankings> {
  const { category, offset = 0 } = request
  const search = request.search?.trim() ?? ''
  if (category !== undefined && !categories.includes(category)) throw new BadRequest(`Unknown category ${category}`)
  if (!Number.isInteger(offset) || offset < 0) throw new BadRequest('offset must be a whole number')
  if (search.length > 100) throw new BadRequest('search is too long')

  // Separate statements for "everyone" and one category, so each uses its own index.
  const scope = category ? 'WHERE f.category = ?1' : 'WHERE ?1 IS NULL'
  const lastRank = category ? 's.category_rank' : 's.rank'
  const page = search
    ? // Search reads every fighter in scope, since a name can match anywhere.
      db
        .prepare(
          `SELECT r.*, ${lastRank} AS last_rank
           FROM (
             SELECT f.*, row_number() OVER (ORDER BY f.elo DESC, f.fighter_id) AS place
             FROM fighter f ${scope}
           ) r
           LEFT JOIN fighter_rating_snapshot s ON s.snapshot_date = ${LAST_WEEK} AND s.fighter_id = r.fighter_id
           WHERE r.name LIKE '%' || ?2 || '%' ESCAPE '\\'
           ORDER BY r.place
           LIMIT ?3 OFFSET ?4`,
        )
        .bind(category ?? null, search.replace(/[\\%_]/g, '\\$&'), RANKINGS_PAGE + 1, offset)
    : db
        .prepare(
          `SELECT f.*, ?2 + row_number() OVER (ORDER BY f.elo DESC, f.fighter_id) AS place, ${lastRank} AS last_rank
           FROM (SELECT * FROM fighter f ${scope} ORDER BY f.elo DESC, f.fighter_id LIMIT ?3 OFFSET ?2) f
           LEFT JOIN fighter_rating_snapshot s ON s.snapshot_date = ${LAST_WEEK} AND s.fighter_id = f.fighter_id
           ORDER BY place`,
        )
        .bind(category ?? null, offset, RANKINGS_PAGE + 1)

  const withCalls = offset === 0 && !search
  const scopeName = category ?? 'all'
  const [pageRows, total, calls, callFighters] = await db.batch<Row>([
    page,
    // vote_id only goes up, so the newest one is the number of votes. One row read.
    db.prepare('SELECT coalesce(max(vote_id), 0) AS total FROM vote'),
    db
      .prepare(
        `SELECT p.fighter_a_id, p.fighter_b_id, p.a_wins, p.b_wins
         FROM closest_call c
         JOIN pair p ON p.fighter_a_id = c.fighter_a_id AND p.fighter_b_id = c.fighter_b_id
         WHERE c.scope = ?1 AND ?2
         ORDER BY c.place`,
      )
      .bind(scopeName, withCalls ? 1 : 0),
    db
      .prepare(
        `SELECT * FROM fighter WHERE ?2 AND fighter_id IN (
           SELECT fighter_a_id FROM closest_call WHERE scope = ?1
           UNION SELECT fighter_b_id FROM closest_call WHERE scope = ?1
         )`,
      )
      .bind(scopeName, withCalls ? 1 : 0),
  ])

  const rows = pageRows.results.slice(0, RANKINGS_PAGE)
  const byId = new Map(callFighters.results.map((r) => [r.fighter_id as string, toFighter(r)]))
  const closestCalls: ClosestCall[] = calls.results.flatMap((r) => {
    const left = byId.get(r.fighter_a_id as string)
    const right = byId.get(r.fighter_b_id as string)
    return left && right ? [{ left, right, leftVotes: r.a_wins as number, rightVotes: r.b_wins as number }] : []
  })

  return {
    totalVotes: total.results[0].total as number,
    fighters: rows.map((r) => toRanked(r, r.place as number, r.last_rank)),
    closestCalls,
    nextOffset: pageRows.results.length > RANKINGS_PAGE ? offset + RANKINGS_PAGE : null,
  }
}

/**
 * Every fighter, best first. The "where do I rank" page needs the whole ladder. This reads every
 * fighter, so app.ts caches the response for a few minutes.
 */
export async function getRoster(db: D1Database): Promise<RankedFighter[]> {
  const { results } = await db
    .prepare(
      `SELECT f.*, s.rank AS last_rank
       FROM fighter f
       LEFT JOIN fighter_rating_snapshot s ON s.snapshot_date = ${LAST_WEEK} AND s.fighter_id = f.fighter_id
       ORDER BY f.elo DESC, f.fighter_id`,
    )
    .run<Row>()
  return results.map((r, i) => toRanked(r, i + 1, r.last_rank))
}

// ---------------------------------------------------------------------------------------------
// Scheduled jobs. These are the only places that read everything.

/** True if anyone voted in the last `minutes`. vote_id grows with time, so this reads one row. */
async function votedSince(db: D1Database, minutes: number) {
  const latest = await db.prepare('SELECT created_at FROM vote ORDER BY vote_id DESC LIMIT 1').first<Row>()
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString().replace('T', ' ').slice(0, 19)
  return latest !== null && (latest.created_at as string) >= cutoff
}

/** Picks the three closest head-to-heads overall and per category. Reads only pairs with enough votes. */
export async function refreshClosestCalls(db: D1Database, ifVotedInMinutes?: number) {
  if (ifVotedInMinutes !== undefined && !(await votedSince(db, ifVotedInMinutes))) return
  const { results } = await db
    .prepare(
      `SELECT p.fighter_a_id, p.fighter_b_id, p.a_wins, p.b_wins, a.category AS a_category, b.category AS b_category
       FROM pair p
       CROSS JOIN fighter a ON a.fighter_id = p.fighter_a_id
       CROSS JOIN fighter b ON b.fighter_id = p.fighter_b_id
       WHERE p.a_wins + p.b_wins >= ${CLOSEST_CALL_MIN_VOTES}`,
    )
    .run<Row>()

  const contested = results
    .map((r) => {
      const n = (r.a_wins as number) + (r.b_wins as number)
      return { r, n, gap: Math.abs((r.a_wins as number) - (r.b_wins as number)) / n }
    })
    .sort((x, y) => x.gap - y.gap || y.n - x.n)

  const insert = db.prepare('INSERT INTO closest_call (scope, place, fighter_a_id, fighter_b_id) VALUES (?1, ?2, ?3, ?4)')
  const statements = [db.prepare('DELETE FROM closest_call')]
  for (const scope of ['all', ...categories]) {
    const top = contested
      .filter(({ r }) => scope === 'all' || (r.a_category === scope && r.b_category === scope))
      .slice(0, 3)
    top.forEach(({ r }, i) => statements.push(insert.bind(scope, i + 1, r.fighter_a_id, r.fighter_b_id)))
  }
  await db.batch(statements)
}

/**
 * Recomputes every rating from all head-to-head totals at once (see worker/ratings.ts), pulled
 * lightly toward each fighter's starting rating. Reads every fighter and every pair, so it runs
 * nightly, and only if anyone voted that day.
 */
export async function refitRatings(db: D1Database, ifVotedInMinutes?: number) {
  if (ifVotedInMinutes !== undefined && !(await votedSince(db, ifVotedInMinutes))) return
  const [fighters, pairs] = await db.batch<Row>([
    db.prepare('SELECT fighter_id, elo, start_elo FROM fighter'),
    db.prepare('SELECT fighter_a_id, fighter_b_id, a_wins, b_wins FROM pair'),
  ])
  const fit = fitRatings(
    new Map(fighters.results.map((r) => [r.fighter_id as string, r.start_elo as number])),
    new Map(fighters.results.map((r) => [r.fighter_id as string, r.elo as number])),
    pairs.results.map(
      (r): Tally => ({
        a: r.fighter_a_id as string,
        b: r.fighter_b_id as string,
        aWins: r.a_wins as number,
        bWins: r.b_wins as number,
      }),
    ),
  )

  const setElo = db.prepare('UPDATE fighter SET elo = ?1 WHERE fighter_id = ?2')
  const updates = fighters.results
    .map((r) => ({ id: r.fighter_id as string, elo: Math.round(fit.get(r.fighter_id as string)!), old: r.elo }))
    .filter((u) => u.elo !== u.old)
    .map((u) => setElo.bind(u.elo, u.id))
  for (let i = 0; i < updates.length; i += 500) await db.batch(updates.slice(i, i + 500))
}

/** Records today's places for "This week". Only the first snapshot each day is kept. scripts/db.ts has a copy. */
const SNAPSHOT_SQL = `
  INSERT OR IGNORE INTO fighter_rating_snapshot (snapshot_date, fighter_id, elo, rank, category_rank)
  SELECT date('now'), fighter_id, elo,
         row_number() OVER (ORDER BY elo DESC, fighter_id),
         row_number() OVER (PARTITION BY category ORDER BY elo DESC, fighter_id)
  FROM fighter
`

export async function takeSnapshot(db: D1Database) {
  await db.batch([
    db.prepare(SNAPSHOT_SQL),
    db.prepare(`DELETE FROM fighter_rating_snapshot WHERE snapshot_date < date('now', '-8 days')`),
  ])
}
