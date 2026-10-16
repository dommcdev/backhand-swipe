import type { RankedFighter } from '../api/types'

export interface BodyStats {
  weightKg: number
  heightCm: number
  age: number
}

export type RatedPerson = RankedFighter & { heightCm: number; age: number }

export const hasBodyStats = (f: RankedFighter): f is RatedPerson => f.heightCm !== undefined && f.age !== undefined

/** Rough fighting size: heavier and taller helps, being far from your late twenties hurts. */
const size = ({ weightKg, heightCm, age }: BodyStats) =>
  (weightKg - 70) * 0.35 + (heightCm - 175) * 0.25 - Math.max(0, Math.abs(age - 27) - 3) * 0.35

/** Fits rating against size across the famous people, then reads off a rating for `you`. */
export function predictRating(people: RatedPerson[], you: BodyStats) {
  const xs = people.map(size)
  const ys = people.map((p) => p.elo)
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length
  const my = ys.reduce((s, y) => s + y, 0) / ys.length
  const slope =
    xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0)
  const elo = Math.round(Math.min(1600, Math.max(600, my + slope * (size(you) - mx))))

  const distance = (p: RatedPerson) =>
    ((p.weightKg - you.weightKg) / 15) ** 2 + ((p.heightCm - you.heightCm) / 10) ** 2 + ((p.age - you.age) / 25) ** 2
  const lookalike = people.reduce((best, p) => (distance(p) < distance(best) ? p : best))

  return { elo, lookalike }
}
