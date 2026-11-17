import type { Category, ClosestCall, Fighter, Matchup, RankedFighter, Rankings, VoteRequest } from '../src/api/types'
import { winChance } from '../src/lib/elo'
import { fitRatings, kFactor, pickPairs, type Tally } from './ratings'

type Row = Record<string, unknown>

export const categories: Category[] = ['people', 'fictional', 'animals', 'objects']
/** A head-to-head needs this many votes before it can show up as a closest call. */
const CLOSEST_CALL_MIN_VOTES = 5

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

/** Number of votes each fighter has been in, counted from `vote`. */
const GAMES_SQL = `
  WITH per_matchup AS (
    SELECT matchup_id, count(*) AS n FROM vote GROUP BY matchup_id
  ),
  per_fighter AS (
    SELECT m.fighter_a_id AS fighter_id, p.n FROM per_matchup p JOIN matchup m USING (matchup_id)
    UNION ALL
    SELECT m.fighter_b_id, p.n FROM per_matchup p JOIN matchup m USING (matchup_id)
  )
  SELECT f.fighter_id, f.elo, coalesce(sum(g.n), 0) AS games
  FROM fighter f
  LEFT JOIN per_fighter g ON g.fighter_id = f.fighter_id
  GROUP BY f.fighter_id
`

export async function getMatchups(db: D1Database, count: number): Promise<Matchup[]> {
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new BadRequest('count must be from 1 to 20')

  const { results: rated } = await db.prepare(GAMES_SQL).run<Row>()
  const pairs = pickPairs(
    rated.map((r) => ({ id: r.fighter_id as string, elo: r.elo as number, games: r.games as number })),
    count,
  )

  // One row per fighter: two rows for each picked matchup.
  const { results: rows } = await db
    .prepare(
      `
      WITH wanted AS (
        SELECT value ->> '$[0]' AS a, value ->> '$[1]' AS b FROM json_each(?1)
      ),
      picked AS MATERIALIZED (
        SELECT m.matchup_id, m.fighter_a_id, m.fighter_b_id
        FROM wanted w
        JOIN matchup m ON m.fighter_a_id = w.a AND m.fighter_b_id = w.b
      ),
      tally AS (
        SELECT p.matchup_id,
               count(v.vote_id) FILTER (WHERE v.winner_id = p.fighter_a_id) AS a_votes,
               count(v.vote_id) FILTER (WHERE v.winner_id = p.fighter_b_id) AS b_votes
        FROM picked p
        LEFT JOIN vote v ON v.matchup_id = p.matchup_id
        GROUP BY p.matchup_id
      )
      SELECT p.matchup_id, 'a' AS side, t.a_votes AS votes, f.*
      FROM picked p
      JOIN tally t ON t.matchup_id = p.matchup_id
      JOIN fighter f ON f.fighter_id = p.fighter_a_id
      UNION ALL
      SELECT p.matchup_id, 'b', t.b_votes, f.*
      FROM picked p
      JOIN tally t ON t.matchup_id = p.matchup_id
      JOIN fighter f ON f.fighter_id = p.fighter_b_id
    `,
    )
    .bind(JSON.stringify(pairs))
    .run<Row>()

  const sides = new Map<number, { fighter: Fighter; votes: number }[]>()
  for (const row of rows) {
    const id = row.matchup_id as number
    sides.set(id, [...(sides.get(id) ?? []), { fighter: toFighter(row), votes: row.votes as number }])
  }

  return [...sides].map(([id, pair]) => {
    const [left, right] = Math.random() < 0.5 ? pair : pair.toReversed()
    return { id, left: left.fighter, right: right.fighter, leftVotes: left.votes, rightVotes: right.votes }
  })
}

const isVoteRequest = (body: unknown): body is VoteRequest =>
  typeof body === 'object' &&
  body !== null &&
  'matchupId' in body &&
  Number.isInteger(body.matchupId) &&
  'winnerId' in body &&
  typeof body.winnerId === 'string'

export async function vote(db: D1Database, body: unknown) {
  if (!isVoteRequest(body)) throw new BadRequest('Expected { matchupId: number, winnerId: string }')
  const { matchupId, winnerId } = body

  const m = await db
    .prepare(
      `
      SELECT m.fighter_a_id, m.fighter_b_id, a.elo AS a_elo, b.elo AS b_elo,
             (SELECT count(*) FROM matchup x JOIN vote v USING (matchup_id) WHERE x.fighter_a_id = m.fighter_a_id) +
             (SELECT count(*) FROM matchup x JOIN vote v USING (matchup_id) WHERE x.fighter_b_id = m.fighter_a_id) AS a_games,
             (SELECT count(*) FROM matchup x JOIN vote v USING (matchup_id) WHERE x.fighter_a_id = m.fighter_b_id) +
             (SELECT count(*) FROM matchup x JOIN vote v USING (matchup_id) WHERE x.fighter_b_id = m.fighter_b_id) AS b_games
      FROM matchup m
      JOIN fighter a ON a.fighter_id = m.fighter_a_id
      JOIN fighter b ON b.fighter_id = m.fighter_b_id
      WHERE m.matchup_id = ?1
    `,
    )
    .bind(matchupId)
    .first<Row>()
  if (!m || (winnerId !== m.fighter_a_id && winnerId !== m.fighter_b_id)) {
    throw new BadRequest(`${winnerId} is not in matchup ${matchupId}`)
  }

  const aScore = winnerId === m.fighter_a_id ? 1 : 0
  const surprise = aScore - winChance(m.a_elo as number, m.b_elo as number)
  // Fighters with few votes move further, so they reach their real rating quickly.
  const aDelta = Math.round(kFactor(m.a_games as number) * surprise)
  const bDelta = Math.round(kFactor(m.b_games as number) * surprise)

  // The ratings were read outside this write so votes never wait on each other. Both updates are
  // increments, so a vote that lands in between is never lost; at worst this delta is computed
  // from a rating that is a few milliseconds old. A batch runs as one transaction.
  // These live updates are instant feedback; refitRatings recomputes everything every few minutes.
  const addElo = db.prepare('UPDATE fighter SET elo = elo + ?1 WHERE fighter_id = ?2')
  await db.batch([
    db.prepare('INSERT INTO vote (matchup_id, winner_id) VALUES (?1, ?2)').bind(matchupId, winnerId),
    addElo.bind(aDelta, m.fighter_a_id),
    addElo.bind(-bDelta, m.fighter_b_id),
  ])
}

export async function getRankings(db: D1Database, category?: Category): Promise<Rankings> {
  if (category !== undefined && !categories.includes(category)) throw new BadRequest(`Unknown category ${category}`)
  const only = category ?? null

  const [ranked, closest, total] = await db.batch<Row>([
    db
      .prepare(
        `
          WITH scope AS (
            SELECT * FROM fighter WHERE ?1 IS NULL OR category = ?1
          ),
          tally AS (
            SELECT m.fighter_a_id,
                   m.fighter_b_id,
                   count(*) FILTER (WHERE v.winner_id = m.fighter_a_id) AS a_votes,
                   count(*) FILTER (WHERE v.winner_id = m.fighter_b_id) AS b_votes
            FROM vote v
            JOIN matchup m ON m.matchup_id = v.matchup_id
            GROUP BY m.matchup_id
          ),
          record AS (
            SELECT fighter_id, sum(wins) AS wins, sum(losses) AS losses
            FROM (
              SELECT fighter_a_id AS fighter_id, a_votes AS wins, b_votes AS losses FROM tally
              UNION ALL
              SELECT fighter_b_id, b_votes, a_votes FROM tally
            )
            GROUP BY fighter_id
          ),
          last_week AS (
            SELECT s.fighter_id, row_number() OVER (ORDER BY s.elo DESC, s.fighter_id) AS place
            FROM fighter_rating_snapshot s
            JOIN scope ON scope.fighter_id = s.fighter_id
            WHERE s.snapshot_date = (
              SELECT min(snapshot_date) FROM fighter_rating_snapshot WHERE snapshot_date >= date('now', '-7 days')
            )
          )
          SELECT f.*,
                 coalesce(r.wins, 0) AS wins,
                 coalesce(r.losses, 0) AS losses,
                 coalesce(lw.place - row_number() OVER (ORDER BY f.elo DESC, f.fighter_id), 0) AS rank_change
          FROM scope f
          LEFT JOIN record r ON r.fighter_id = f.fighter_id
          LEFT JOIN last_week lw ON lw.fighter_id = f.fighter_id
          ORDER BY f.elo DESC, f.fighter_id
        `,
      )
      .bind(only),
    db
      .prepare(
        `
          SELECT m.fighter_a_id,
                 m.fighter_b_id,
                 count(*) FILTER (WHERE v.winner_id = m.fighter_a_id) AS a_votes,
                 count(*) FILTER (WHERE v.winner_id = m.fighter_b_id) AS b_votes
          FROM vote v
          JOIN matchup m ON m.matchup_id = v.matchup_id
          JOIN fighter a ON a.fighter_id = m.fighter_a_id
          JOIN fighter b ON b.fighter_id = m.fighter_b_id
          WHERE ?1 IS NULL OR (a.category = ?1 AND b.category = ?1)
          GROUP BY m.matchup_id
          HAVING count(*) >= ?2
          ORDER BY abs(a_votes - b_votes) * 1.0 / count(*), count(*) DESC
          LIMIT 3
        `,
      )
      .bind(only, CLOSEST_CALL_MIN_VOTES),
    db.prepare('SELECT count(*) AS total FROM vote'),
  ])

  const fighters: RankedFighter[] = ranked.results.map((row) => ({
    ...toFighter(row),
    elo: row.elo as number,
    wins: row.wins as number,
    losses: row.losses as number,
    rankChange: row.rank_change as number,
  }))
  const byId = new Map(fighters.map((f) => [f.id, f]))
  const closestCalls: ClosestCall[] = closest.results.map((row) => ({
    left: byId.get(row.fighter_a_id as string)!,
    right: byId.get(row.fighter_b_id as string)!,
    leftVotes: row.a_votes as number,
    rightVotes: row.b_votes as number,
  }))

  return { totalVotes: total.results[0].total as number, fighters, closestCalls }
}

/**
 * Recomputes every rating from all votes at once (see worker/ratings.ts). Each fighter's starting
 * rating is its earliest snapshot, which the import writes when the fighter is added.
 * A vote that lands between the read and the write loses its live update, but it is in `vote`,
 * so the next refit counts it.
 */
export async function refitRatings(db: D1Database) {
  const [fighters, tallies] = await db.batch<Row>([
    db.prepare(`
      SELECT f.fighter_id, f.elo,
             coalesce((SELECT s.elo FROM fighter_rating_snapshot s
                       WHERE s.fighter_id = f.fighter_id ORDER BY s.snapshot_date LIMIT 1), 1000) AS prior
      FROM fighter f
    `),
    db.prepare(`
      SELECT m.fighter_a_id, m.fighter_b_id,
             count(*) FILTER (WHERE v.winner_id = m.fighter_a_id) AS a_wins,
             count(*) FILTER (WHERE v.winner_id = m.fighter_b_id) AS b_wins
      FROM vote v
      JOIN matchup m ON m.matchup_id = v.matchup_id
      GROUP BY m.matchup_id
    `),
  ])

  const fit = fitRatings(
    new Map(fighters.results.map((r) => [r.fighter_id as string, r.prior as number])),
    tallies.results.map(
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
  if (updates.length) await db.batch(updates)
}

/** Records today's ratings. Only the first snapshot each day is kept, so "this week" compares against that. */
export async function takeSnapshot(db: D1Database) {
  await db
    .prepare(
      `
    INSERT OR IGNORE INTO fighter_rating_snapshot (snapshot_date, fighter_id, elo)
    SELECT date('now'), fighter_id, elo FROM fighter
  `,
    )
    .run()
}
