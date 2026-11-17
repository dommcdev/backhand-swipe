import { winChance } from '../src/lib/elo'

// How ratings get the most out of each vote:
//
// 1. Matchmaking (pickPairs) favors fighters with few votes and pairs them with fighters rated
//    close to them. A vote on an obvious matchup tells us almost nothing.
// 2. Live updates (kFactor) move a fighter a lot while it has few votes and settle down as votes
//    pile up, so a new fighter reaches its real rating quickly.
// 3. A refit (fitRatings) every few minutes recomputes every rating from all votes at once
//    (a Bradley-Terry fit). It doesn't depend on vote order, and early votes get re-weighed
//    against everything since. Live updates are just instant feedback between refits.
//
// A fighter's uncertainty comes from how many votes it has been in, which is counted from `vote`,
// so none of this needs extra columns.

export type RatedFighter = { id: string; elo: number; games: number }

/** Votes a fighter has been in before it counts as settled. Drives matchmaking and the live K factor. */
const SETTLED_GAMES = 10

/** How much a fighter's rating is uncertain, from 1 (no votes) toward 0. */
const uncertainty = (games: number) => 1 / (1 + games / SETTLED_GAMES)

/** Live K factor: 64 for a new fighter, 40 at 10 votes, about 18 once settled. Never below 16. */
export const kFactor = (games: number) => 16 + 48 * uncertainty(games)

/** Share of matchups picked completely at random, so every pair can come up eventually. */
const EXPLORE = 0.15
/** Rating gap at which a pairing becomes unlikely. 200 points is about a 76% favorite. */
const CLOSENESS = 200

function weightedPick<T>(items: T[], weight: (item: T) => number): T {
  const weights = items.map(weight)
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

/**
 * Picks `count` pairs of fighter ids, each ordered smallest id first like the matchup table.
 * A fighter shows up at most once per batch while enough fighters remain.
 */
export function pickPairs(fighters: RatedFighter[], count: number): [string, string][] {
  const pairs: [string, string][] = []
  const seen = new Set<string>()
  let pool = fighters
  let retries = 0

  while (pairs.length < count && fighters.length >= 2) {
    if (pool.length < 2) pool = fighters
    let a: RatedFighter
    let b: RatedFighter
    if (Math.random() < EXPLORE) {
      a = weightedPick(pool, () => 1)
      b = weightedPick(
        pool.filter((f) => f !== a),
        () => 1,
      )
    } else {
      a = weightedPick(pool, (f) => uncertainty(f.games))
      // Unsure ratings get a wider net, since we don't really know who is close to them yet.
      const spread = CLOSENESS * (1 + uncertainty(a.games))
      b = weightedPick(
        pool.filter((f) => f !== a),
        (f) => Math.exp(-(((f.elo - a.elo) / spread) ** 2) / 2) * (0.25 + uncertainty(f.games)),
      )
    }
    const pair: [string, string] = a.id < b.id ? [a.id, b.id] : [b.id, a.id]
    const key = pair.join(' ')
    if (seen.has(key) && retries++ < 20) continue
    seen.add(key)
    pairs.push(pair)
    pool = pool.filter((f) => f !== a && f !== b)
  }
  return pairs
}

export type Tally = { a: string; b: string; aWins: number; bWins: number }

/**
 * Prior strength: how far from its starting rating a fighter is expected to end up. 300 points is
 * worth about one vote, so the starting rating only matters until a fighter has a few votes.
 */
const PRIOR_SPREAD = 300
/** Converts the Elo scale (400 points = 10x odds) to natural log-odds. */
const SCALE = Math.log(10) / 400

/**
 * Bradley-Terry fit with a prior pulling each fighter toward its starting rating. That prior keeps
 * unbeaten and unvoted fighters at sensible numbers and stops the whole scale from drifting.
 * Returns each fighter's rating on the usual Elo scale.
 */
export function fitRatings(priors: Map<string, number>, tallies: Tally[]): Map<string, number> {
  const ratings = new Map(priors)
  const games = new Map<string, Tally[]>()
  for (const t of tallies) {
    if (!priors.has(t.a) || !priors.has(t.b)) continue
    games.set(t.a, [...(games.get(t.a) ?? []), t])
    games.set(t.b, [...(games.get(t.b) ?? []), t])
  }
  const priorPrecision = 1 / PRIOR_SPREAD ** 2

  // Coordinate-wise Newton steps. The problem is concave, so this converges to the single best fit.
  for (let sweep = 0; sweep < 200; sweep++) {
    let biggest = 0
    for (const [id, prior] of priors) {
      const r = ratings.get(id)!
      let gradient = -(r - prior) * priorPrecision
      let curvature = priorPrecision
      for (const t of games.get(id) ?? []) {
        const isA = t.a === id
        const wins = isA ? t.aWins : t.bWins
        const n = t.aWins + t.bWins
        const p = winChance(r, ratings.get(isA ? t.b : t.a)!)
        gradient += SCALE * (wins - n * p)
        curvature += SCALE ** 2 * n * p * (1 - p)
      }
      const step = Math.max(-200, Math.min(200, gradient / curvature))
      ratings.set(id, r + step)
      biggest = Math.max(biggest, Math.abs(step))
    }
    if (biggest < 0.01) break
  }
  return ratings
}
