import { useSyncExternalStore } from 'react'

export type Units = 'metric' | 'imperial'

const STORAGE_KEY = 'bhs:units'
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM'])
const listeners = new Set<() => void>()

function initialUnits(): Units {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'metric' || saved === 'imperial') return saved
  } catch {
    // Fall through to the locale default.
  }
  const region = new Intl.Locale(navigator.language).maximize().region
  return region && IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric'
}

let current = initialUnits()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setUnits(units: Units) {
  current = units
  try {
    localStorage.setItem(STORAGE_KEY, units)
  } catch {
    // Storage can be unavailable in private browsing; the units still apply for this visit.
  }
  listeners.forEach((listener) => listener())
}

export const useUnits = () => useSyncExternalStore(subscribe, () => current)
