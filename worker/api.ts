import type {
  Category,
  Fighter,
  FighterInput,
  Matchup,
  RankedFighter,
  Rankings,
  RankingsRequest,
  VoteRequest,
} from '../src/api/types'
import { winChance } from '../src/lib/elo'
import * as sql from './db'
import type { FighterRow, FighterValues } from './db'
import { closeness, EXPLORE, fitRatings, gaussian, kFactor, opponentSpread, uncertainty, weightedPick } from './ratings'

// The logic behind each endpoint. All SQL lives in worker/db.ts.

export const categories: Category[] = ['people', 'fictional', 'animals', 'objects']
const RANKINGS_PAGE = 50

export class BadRequest extends Error {}

const toFighter = (row: FighterRow): Fighter => ({
  id: row.fighter_id,
  name: row.name,
  shortName: row.short_name,
  category: row.category as Category,
  count: row.quantity,
  emoji: row.emoji ?? undefined,
  imageUrl: row.image_url ?? undefined,
  weightKg: row.weight_kg,
  heightCm: row.height_cm ?? undefined,
  age: row.age ?? undefined,
})

const toRanked = (row: FighterRow, rank: number, lastRank: number | null): RankedFighter => ({
  ...toFighter(row),
  elo: row.elo,
  wins: row.wins,
  losses: row.losses,
  rank,
  rankChange: lastRank === null ? 0 : lastRank - rank,
})

const games = (f: FighterRow) => f.wins + f.losses
const pairId = (a: string, b: string) => (a < b ? `${a}~${b}` : `${b}~${a}`)

// ---------------------------------------------------------------------------------------------
// Fighters

const text = (value: unknown, field: string, max: number) => {
  if (typeof value !== 'string' || value.trim() === '') throw new BadRequest(`${field} is required`)
  if (value.trim().length > max) throw new BadRequest(`${field} must be at most ${max} characters`)
  return value.trim()
}

const optionalText = (value: unknown, field: string, max: number) =>
  value === undefined || value === null || value === '' ? null : text(value, field, max)

const number = (value: unknown, field: string, min: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) throw new BadRequest(`${field} must be a number of at least ${min}`)
  return value
}

const optionalNumber = (value: unknown, field: string, min: number) =>
  value === undefined || value === null ? null : Math.round(number(value, field, min))

/** Checks what the characters page sent and turns it into column values. */
function toFighterValues(body: unknown): FighterValues {
  if (typeof body !== 'object' || body === null) throw new BadRequest('Expected a fighter')
  const input = body as Partial<Record<keyof FighterInput, unknown>>
  if (!categories.includes(input.category as Category)) throw new BadRequest(`category must be one of ${categories.join(', ')}`)
  const name = text(input.name, 'name', 60)
  return {
    name,
    short_name: optionalText(input.shortName, 'shortName', 60) ?? name,
    category: input.category as Category,
    quantity: Math.round(number(input.count, 'count', 1)),
    emoji: optionalText(input.emoji, 'emoji', 8),
    weight_kg: number(input.weightKg, 'weightKg', 0.001),
    height_cm: optionalNumber(input.heightCm, 'heightCm', 1),
    age: optionalNumber(input.age, 'age', 0),
  }
}

export async function listFighters(db: D1Database): Promise<Fighter[]> {
  return (await sql.getAllFighters(db)).map(toFighter)
}

export async function createFighter(db: D1Database, body: unknown): Promise<Fighter> {
  const values = toFighterValues(body)
  // The id comes from the name, like "5 gorillas" -> "5-gorillas". Add a number if it is taken.
  const base = values.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'fighter'
  let id = base
  for (let n = 2; await sql.getFighter(db, id); n++) id = `${base}-${n}`
  await sql.addFighter(db, id, values)
  return toFighter((await sql.getFighter(db, id))!)
}

export async function editFighter(db: D1Database, id: string, body: unknown) {
  const values = toFighterValues(body)
  if (!(await sql.getFighter(db, id))) throw new BadRequest(`Unknown fighter ${id}`)
  await sql.updateFighter(db, id, values)
}

export async function removeFighter(db: D1Database, id: string) {
  if (!(await sql.getFighter(db, id))) throw new BadRequest(`Unknown fighter ${id}`)
  await sql.deleteFighter(db, id)
}

// ---------------------------------------------------------------------------------------------
// Matchups

/** How many fighters with the fewest votes to consider each time. */
const NEW_POOL = 40
/** Share of matchups built around one of the fighters with the fewest votes. */
const NEW_SHARE = 0.6
/** How many fighters on each side of the target rating to choose an opponent from. */
const NEIGHBORS = 4

export async function getMatchups(db: D1Database, count: number): Promise<Matchup[]> {
  if (!Number.isInteger(count) || count < 1 || count > 5) throw new BadRequest('count must be from 1 to 5')
  const maxRowid = await sql.getMaxRowid(db)
  if (maxRowid === 0) return []

  // 1. Fighters with the fewest votes, plus some random ones.
  const randomRowids = Array.from({ length: count * 2 }, () => 1 + Math.floor(Math.random() * maxRowid))
  const [newest, random] = await Promise.all([sql.getNewFighters(db, NEW_POOL), sql.getFightersAtRowids(db, randomRowids)])

  // A fighter appears at most once per batch while there are enough to go around.
  const used = new Set<string>()
  const unused = (list: FighterRow[], not?: FighterRow) => list.filter((f) => !used.has(f.fighter_id) && f.fighter_id !== not?.fighter_id)

  const leads: FighterRow[] = []
  for (let i = 0; i < count; i++) {
    const pool = Math.random() < NEW_SHARE ? unused(newest) : []
    const lead =
      weightedPick(pool, (f) => uncertainty(games(f))) ?? weightedPick(unused(random), () => 1) ?? weightedPick(unused(newest), () => 1)
    if (!lead) break
    used.add(lead.fighter_id)
    leads.push(lead)
  }

  // 2. An opponent for each: usually someone rated close to the lead, so the result is hard to
  // call. Fighters with few votes look further afield. A few opponents are fully random.
  const plans = leads.map((lead) => ({
    explore: Math.random() < EXPLORE,
    target: Math.round(lead.elo + gaussian() * opponentSpread(games(lead))),
  }))
  const near = await sql.getFightersNearRatings(db, plans.filter((p) => !p.explore).map((p) => p.target), NEIGHBORS)
  let nextNear = 0
  const options = plans.map((p) => (p.explore ? random : near[nextNear++]))

  const pairs: [FighterRow, FighterRow][] = []
  const seenPairs = new Set<string>()
  leads.forEach((lead, i) => {
    // Exploration stays uniform so every pair can come up. Otherwise, the closer the ratings the likelier the pick.
    const even = (f: FighterRow) => (plans[i].explore ? 1 : closeness(lead.elo, f.elo))
    const opponent =
      weightedPick(unused(options[i], lead), (f) => (0.25 + uncertainty(games(f))) * even(f)) ??
      weightedPick(unused(random, lead), even) ??
      weightedPick([...options[i], ...random, ...newest].filter((f) => f.fighter_id !== lead.fighter_id), () => 1)
    if (!opponent) return
    const id = pairId(lead.fighter_id, opponent.fighter_id)
    if (seenPairs.has(id)) return
    seenPairs.add(id)
    used.add(opponent.fighter_id)
    pairs.push(lead.fighter_id < opponent.fighter_id ? [lead, opponent] : [opponent, lead])
  })

  // 3. The head-to-head so far for each pair.
  const tallies = await sql.getPairs(db, pairs.map(([a, b]) => [a.fighter_id, b.fighter_id]))

  return pairs.map(([a, b], i) => {
    const aVotes = tallies[i]?.a_wins ?? 0
    const bVotes = tallies[i]?.b_wins ?? 0
    const flip = Math.random() < 0.5
    return {
      id: pairId(a.fighter_id, b.fighter_id),
      left: toFighter(flip ? b : a),
      right: toFighter(flip ? a : b),
      leftVotes: flip ? bVotes : aVotes,
      rightVotes: flip ? aVotes : bVotes,
    }
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

  const [fa, fb] = await Promise.all([sql.getFighter(db, a), sql.getFighter(db, b)])
  if (!fa || !fb) throw new BadRequest(`Unknown matchup ${matchupId}`)

  const aWon = winnerId === a ? 1 : 0
  const surprise = aWon - winChance(fa.elo, fb.elo)
  // Fighters with few votes move further, so they reach their real rating quickly.
  const aChange = Math.round(kFactor(games(fa)) * surprise)
  const bChange = -Math.round(kFactor(games(fb)) * surprise)
  await sql.addVote(db, a, b, winnerId, aChange, bChange)
}

// ---------------------------------------------------------------------------------------------
// Rankings

export async function getRankings(db: D1Database, request: RankingsRequest): Promise<Rankings> {
  const { category, offset = 0 } = request
  const search = request.search?.trim() ?? ''
  if (category !== undefined && !categories.includes(category)) throw new BadRequest(`Unknown category ${category}`)
  if (!Number.isInteger(offset) || offset < 0) throw new BadRequest('offset must be a whole number')
  if (search.length > 100) throw new BadRequest('search is too long')

  // Ask for one extra row to know whether there is another page.
  const [rows, totalVotes] = await Promise.all([
    sql.getRankingsPage(db, category ?? null, search, RANKINGS_PAGE + 1, offset),
    sql.getVoteCount(db),
  ])

  return {
    totalVotes,
    fighters: rows
      .slice(0, RANKINGS_PAGE)
      .map((r) => toRanked(r, r.place, category ? r.last_category_rank : r.last_rank)),
    nextOffset: rows.length > RANKINGS_PAGE ? offset + RANKINGS_PAGE : null,
  }
}

/** Every fighter, best first, for the "where do I rank" page. */
export async function getRoster(db: D1Database): Promise<RankedFighter[]> {
  const rows = await sql.getRoster(db)
  return rows.map((r, i) => toRanked(r, i + 1, r.last_rank))
}

// ---------------------------------------------------------------------------------------------
// Scheduled jobs

/** True if anyone voted in the last `minutes`. */
async function votedSince(db: D1Database, minutes: number) {
  const latest = await sql.getLatestVoteTime(db)
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString().replace('T', ' ').slice(0, 19)
  return latest !== null && latest >= cutoff
}

/**
 * Recomputes every rating from all head-to-head totals at once (see worker/ratings.ts), pulled
 * lightly toward each fighter's starting rating. Runs nightly, only if anyone voted that day.
 */
export async function refitRatings(db: D1Database, ifVotedInMinutes?: number) {
  if (ifVotedInMinutes !== undefined && !(await votedSince(db, ifVotedInMinutes))) return
  const [fighters, pairs] = await Promise.all([sql.getAllFighters(db), sql.getAllPairs(db)])
  const fit = fitRatings(
    new Map(fighters.map((f) => [f.fighter_id, f.start_elo])),
    new Map(fighters.map((f) => [f.fighter_id, f.elo])),
    pairs.map((p) => ({ a: p.fighter_a_id, b: p.fighter_b_id, aWins: p.a_wins, bWins: p.b_wins })),
  )
  const changed = fighters
    .map((f) => ({ id: f.fighter_id, elo: Math.round(fit.get(f.fighter_id)!), old: f.elo }))
    .filter((r) => r.elo !== r.old)
  await sql.setRatings(db, changed)
}
