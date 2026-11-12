import { useSyncExternalStore } from 'react'

/** The BackColor options under View. Named like System.Drawing.Color, because that is where they came from. */
export const backColors = [
  { id: 'control', name: 'Control' },
  { id: 'light-pink', name: 'LightPink' },
  { id: 'pale-green', name: 'PaleGreen' },
  { id: 'light-sky-blue', name: 'LightSkyBlue' },
  { id: 'khaki', name: 'Khaki' },
] as const

export type BackColorId = (typeof backColors)[number]['id']

const STORAGE_KEY = 'bhs:backcolor'
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const read = () => document.documentElement.dataset.theme as BackColorId

export function setBackColor(id: BackColorId) {
  document.documentElement.dataset.theme = id
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Storage can be unavailable in private browsing; the color still applies for this visit.
  }
  listeners.forEach((listener) => listener())
}

export const useBackColor = () => useSyncExternalStore(subscribe, read)
