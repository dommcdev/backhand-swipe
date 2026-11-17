import { winChance } from '../src/lib/elo'

// How ratings get the most out of each vote:
//
// 1. Matchmaking (worker/api.ts) favors fighters with few votes and pairs them with fighters rated
//    close to them. A vote on an obvious matchup tells us almost nothing.
// 2. Live updates (kFactor) move a fighter a lot while it has few votes and settle down as votes
//    pile up, so a new fighter reaches its real rating quickly.
// 3. A nightly refit (fitRatings) recomputes every rating from all head-to-head totals at once
//    (a Bradley-Terry fit). Vote order stops mattering, and early votes get re-weighed against
//    everything since.

/** Votes a fighter has been in before it counts as settled. */
const SETTLED_GAMES = 10

/** How unsure a fighter's rating is, from 1 (no votes) toward 0. */
export const uncertainty = (games: number) => 1 / (1 + games / SETTLED_GAMES)

/** Live K factor: 64 for a new fighter, 40 at 10 votes, about 18 once settled. Never below 16. */
export const kFactor = (games: number) => 16 + 48 * uncertainty(games)

/** Share of matchups against a completely random opponent, so every pair can come up eventually. */
export const EXPLORE = 0.15

/** How far from a fighter's rating to look for an opponent. 200 points is about a 76% favorite. */
export const opponentSpread = (games: number) => 200 * (1 + uncertainty(games))

/** Normally distributed random number. */
export function gaussian() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())
}

export function weightedPick<T>(items: T[], weight: (item: T) => number): T | undefined {
  const weights = items.map(weight)
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items.at(-1)
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
 * `start` is where the search begins (the current ratings, which are already close).
 */
export function fitRatings(
  priors: Map<string, number>,
  start: Map<string, number>,
  tallies: Tally[],
  maxSweeps = 100,
): Map<string, number> {
  const ratings = new Map([...priors].map(([id, prior]) => [id, start.get(id) ?? prior]))
  const games = new Map<string, Tally[]>()
  for (const t of tallies) {
    if (!priors.has(t.a) || !priors.has(t.b)) continue
    games.set(t.a, [...(games.get(t.a) ?? []), t])
    games.set(t.b, [...(games.get(t.b) ?? []), t])
  }
  const priorPrecision = 1 / PRIOR_SPREAD ** 2

  // Coordinate-wise Newton steps. The problem is concave, so this converges to the single best fit.
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
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
    if (biggest < 0.05) break
  }
  return ratings
}
