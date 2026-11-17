import type { RankedFighter } from '../api/types'

export interface BodyStats {
  weightKg: number
  heightCm: number
  age: number
}

export type RatedPerson = RankedFighter & { heightCm: number; age: number }

export const hasBodyStats = (f: RankedFighter): f is RatedPerson => f.heightCm !== undefined && f.age !== undefined

/**
 * Curves for how body size moves rating, fit from the people who have all three stats.
 * `base` is their average rating. Each curve is the move away from that average.
 */
export interface BodyEffects {
  base: number
  meanWeightKg: number
  meanHeightCm: number
  meanAge: number
  /** Rating at this height for someone with the usual weight for that height, at the average age. */
  byHeight: (heightCm: number) => number
  /** Rating at this weight for someone of average height and age. */
  byWeight: (weightKg: number) => number
  /** Rating at this age for someone of average height and weight. */
  byAge: (age: number) => number
  rating: (you: BodyStats) => number
}

const MIN_RATING = 600
const MAX_RATING = 1600

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

/** A short roster can only support a straight line. More people earn a bend, then a second bend. */
function degreesFor(count: number) {
  if (count >= 20) return { height: 3, mass: 2, age: 3 }
  if (count >= 8) return { height: 2, mass: 2, age: 2 }
  return { height: 1, mass: 1, age: 1 }
}

function solve(matrix: number[][], right: number[]) {
  const size = right.length
  const rows = matrix.map((row, i) => [...row, right[i]])
  for (let col = 0; col < size; col++) {
    let pivot = col
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row
    }
    ;[rows[col], rows[pivot]] = [rows[pivot], rows[col]]
    const diag = rows[col][col]
    if (Math.abs(diag) < 1e-10) continue
    for (let row = 0; row < size; row++) {
      if (row === col) continue
      const factor = rows[row][col] / diag
      for (let k = col; k <= size; k++) rows[row][k] -= factor * rows[col][k]
    }
  }
  return rows.map((row, i) => (Math.abs(row[i]) < 1e-10 ? 0 : row[size] / row[i]))
}

type Column = {
  kind: 'height' | 'mass' | 'age'
  degree: number
  center: number
  scale: number
  shift: number
  beta: number
}

/**
 * Fits a polynomial for height, for how heavy someone is relative to their height, and for age.
 * Height is scored along the weight people of that height usually have, so a very tall and very
 * light person misses the curve instead of bending it. Age and height get three powers once the
 * roster is long enough for the prime-age hump and the tall-end rise to show. Extra pounds get
 * two. Points the curves cannot explain are down-weighted, so one outlier does not steer them.
 */
export function fitBodyEffects(people: RatedPerson[]): BodyEffects {
  const base = people.length ? mean(people.map((p) => p.elo)) : 1000
  const meanWeightKg = people.length ? mean(people.map((p) => p.weightKg)) : 0
  const meanHeightCm = people.length ? mean(people.map((p) => p.heightCm)) : 0
  const meanAge = people.length ? mean(people.map((p) => p.age)) : 0
  const flat: BodyEffects = {
    base,
    meanWeightKg,
    meanHeightCm,
    meanAge,
    byHeight: () => base,
    byWeight: () => base,
    byAge: () => base,
    rating: () => base,
  }
  if (people.length < 2) return flat

  const heightDev = people.map((p) => p.heightCm - meanHeightCm)
  const heightScale = Math.sqrt(mean(heightDev.map((v) => v * v)))
  const weightDev = people.map((p) => p.weightKg - meanWeightKg)
  // Kilograms that usually come with an extra centimeter. Zero when nobody differs in height.
  const kgPerCm =
    heightScale === 0
      ? 0
      : heightDev.reduce((sum, dev, i) => sum + dev * weightDev[i], 0) / heightDev.reduce((sum, dev) => sum + dev * dev, 0)
  const expectedWeight = (heightCm: number) => meanWeightKg + kgPerCm * (heightCm - meanHeightCm)
  const mass = people.map((p) => p.weightKg - expectedWeight(p.heightCm))
  const massScale = Math.sqrt(mean(mass.map((v) => v * v))) || 1
  const ageDev = people.map((p) => p.age - meanAge)
  const ageScale = Math.sqrt(mean(ageDev.map((v) => v * v))) || 1

  const degrees = degreesFor(people.length)
  const specs: { kind: Column['kind']; degree: number; center: number; scale: number; values: number[] }[] = []
  const pushPowers = (kind: Column['kind'], degree: number, center: number, scale: number, values: number[]) => {
    if (scale === 0) return
    for (let power = 1; power <= degree; power++) specs.push({ kind, degree: power, center, scale, values })
  }
  pushPowers('height', degrees.height, meanHeightCm, heightScale || 1, people.map((p) => p.heightCm))
  pushPowers('mass', degrees.mass, 0, massScale, mass)
  pushPowers('age', degrees.age, meanAge, ageScale, people.map((p) => p.age))
  if (specs.length === 0) return flat

  const zPowers = specs.map((spec) => spec.values.map((value) => ((value - spec.center) / spec.scale) ** spec.degree))
  const shifts = zPowers.map(mean)
  const columns = zPowers.map((col, j) => col.map((value) => value - shifts[j]))
  const y = people.map((p) => p.elo - base)
  let weights = people.map(() => 1)

  const betasFor = () => {
    const size = columns.length
    const xtx = Array.from({ length: size }, () => Array(size).fill(0))
    const xty = Array(size).fill(0)
    for (let j = 0; j < size; j++) {
      // Higher powers have to earn their place. A short roster leans on them even less.
      const penalty = specs[j].degree ** 2 * Math.max(1, 16 / people.length)
      for (let k = j; k < size; k++) {
        let sum = j === k ? penalty : 0
        for (let i = 0; i < people.length; i++) sum += weights[i] * columns[j][i] * columns[k][i]
        xtx[j][k] = xtx[k][j] = sum
      }
      let sum = 0
      for (let i = 0; i < people.length; i++) sum += weights[i] * columns[j][i] * y[i]
      xty[j] = sum
    }
    return solve(xtx, xty)
  }

  let beta = betasFor()
  for (let iter = 0; iter < 15; iter++) {
    const residual = y.map((value, i) => value - columns.reduce((sum, col, j) => sum + beta[j] * col[i], 0))
    const abs = residual.map(Math.abs).sort((a, b) => a - b)
    const sigma = abs[Math.floor(abs.length / 2)] / 0.6745
    if (sigma < 1e-6) break
    // Tukey's bisquare: a point the curves miss by a wide margin stops pulling on them.
    const cutoff = 4.685 * sigma
    weights = residual.map((miss) => {
      const ratio = miss / cutoff
      return Math.abs(ratio) >= 1 ? 0 : (1 - ratio * ratio) ** 2
    })
    beta = betasFor()
  }

  const columnsFit: Column[] = specs.map((spec, j) => ({ ...spec, shift: shifts[j], beta: beta[j] }))
  const heightMin = Math.min(...people.map((p) => p.heightCm))
  const heightMax = Math.max(...people.map((p) => p.heightCm))
  const massMin = Math.min(...mass)
  const massMax = Math.max(...mass)
  // Height and extra weight can level off, but they are not allowed to turn
  // downward inside the roster. A tall lightweight then misses the height curve
  // instead of dragging the tall end down with them.
  for (const kind of ['height', 'mass'] as const) {
    const terms = columnsFit.filter((term) => term.kind === kind)
    const linear = terms.find((term) => term.degree === 1)
    if (!linear || linear.beta <= 0) continue
    const zOf = kind === 'height'
      ? (raw: number) => (raw - meanHeightCm) / (heightScale || 1)
      : (raw: number) => raw / massScale
    const zMin = zOf(kind === 'height' ? heightMin : massMin)
    const zMax = zOf(kind === 'height' ? heightMax : massMax)
    const slope = (z: number, scale: number) =>
      terms.reduce((sum, term) => sum + (term.degree === 1 ? term.beta : term.beta * scale) * term.degree * z ** (term.degree - 1), 0)
    const lowest = (scale: number) => {
      let low = Infinity
      for (let step = 0; step <= 32; step++) low = Math.min(low, slope(zMin + (zMax - zMin) * (step / 32), scale))
      return low
    }
    let kept = 1
    if (lowest(1) < 0) {
      let lo = 0
      let hi = 1
      for (let step = 0; step < 24; step++) {
        const mid = (lo + hi) / 2
        if (lowest(mid) >= 0) lo = mid
        else hi = mid
      }
      kept = lo
    }
    for (const term of terms) if (term.degree > 1) term.beta *= kept
  }

  const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value))
  const effect = (you: BodyStats) =>
    columnsFit.reduce((sum, term) => {
      const raw =
        term.kind === 'height'
          ? clamp(you.heightCm, heightMin, heightMax)
          : term.kind === 'age'
            ? you.age
            : clamp(you.weightKg - expectedWeight(you.heightCm), massMin, massMax)
      const z = (raw - term.center) / term.scale
      return sum + term.beta * (z ** term.degree - term.shift)
    }, 0)

  const rating = (you: BodyStats) => base + effect(you)
  return {
    base,
    meanWeightKg,
    meanHeightCm,
    meanAge,
    byHeight: (heightCm) => rating({ weightKg: expectedWeight(heightCm), heightCm, age: meanAge }),
    byWeight: (weightKg) => rating({ weightKg, heightCm: meanHeightCm, age: meanAge }),
    byAge: (age) => rating({ weightKg: meanWeightKg, heightCm: meanHeightCm, age }),
    rating,
  }
}

/** Places `you` on the same rating scale as `people`, using the curves their ratings imply. */
export function predictRating(people: RatedPerson[], you: BodyStats) {
  const raw = fitBodyEffects(people).rating(you)
  const elo = Math.round(Math.min(MAX_RATING, Math.max(MIN_RATING, raw)))

  const distance = (p: RatedPerson) =>
    ((p.weightKg - you.weightKg) / 15) ** 2 + ((p.heightCm - you.heightCm) / 10) ** 2 + ((p.age - you.age) / 25) ** 2
  const lookalike = people.reduce((best, p) => (distance(p) < distance(best) ? p : best))

  return { elo, lookalike }
}
