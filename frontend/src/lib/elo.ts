/** Chance that a fighter rated `a` beats a fighter rated `b`. */
export function winChance(a: number, b: number) {
  return 1 / (1 + 10 ** ((b - a) / 400))
}
