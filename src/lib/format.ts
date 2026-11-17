import type { Units } from './units'

const numberFormat = new Intl.NumberFormat('en-US')

export const LB_PER_KG = 2.20462
export const CM_PER_IN = 2.54

export const formatNumber = (n: number) => numberFormat.format(n)

export function formatWeight(kg: number, units: Units) {
  if (units === 'imperial') {
    const lb = kg * LB_PER_KG
    if (lb >= 1) return `${formatNumber(Math.round(lb))} lb`
    return lb * 16 >= 1 ? `${Math.round(lb * 16)} oz` : 'under 1 oz'
  }
  if (kg >= 1) return `${formatNumber(Math.round(kg))} kg`
  if (kg >= 0.001) return `${Math.round(kg * 1000)} g`
  return `${Math.max(1, Math.round(kg * 1_000_000))} mg`
}

/** 5′10″ or 178 cm; giants like Godzilla in whole feet or metres. */
export function formatHeight(cm: number, units: Units) {
  if (units === 'imperial') {
    const totalIn = Math.round(cm / CM_PER_IN)
    if (totalIn < 12) return `${totalIn} in`
    if (totalIn >= 120) return `${formatNumber(Math.round(totalIn / 12))} ft`
    return `${Math.floor(totalIn / 12)}′${totalIn % 12}″`
  }
  if (cm < 1000) return `${Math.round(cm)} cm`
  return `${formatNumber(Math.round(cm / 100))} m`
}

export function ordinal(n: number) {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0])
}

export const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)
