const numberFormat = new Intl.NumberFormat('en-US')

export const formatNumber = (n: number) => numberFormat.format(n)

export function formatWeight(kg: number) {
  if (kg >= 1) return `${formatNumber(Math.round(kg))} kg`
  if (kg >= 0.001) return `${Math.round(kg * 1000)} g`
  return `${Math.max(1, Math.round(kg * 1_000_000))} mg`
}

export function ordinal(n: number) {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0])
}

export const percent = (part: number, whole: number) => Math.round((part / whole) * 100)
