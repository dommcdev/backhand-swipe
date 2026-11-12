import { useSyncExternalStore } from 'react'

export const palettes = [
  { id: 'main-menu', name: 'Main menu', swatch: ['#e2e7eb', '#e8131b', '#1478f0'] },
  { id: 'after-dark', name: 'After dark', swatch: ['#161b21', '#ff2a6d', '#00a8ff'] },
  { id: 'vault', name: 'Vault', swatch: ['#f8c4dc', '#ff5a1f', '#00a99d'] },
  { id: 'ultraviolet', name: 'Ultraviolet', swatch: ['#cfc1ff', '#ff2d6f', '#5a2ee6'] },
  { id: 'online', name: 'Online', swatch: ['#ffcf8f', '#ff3b1f', '#6a2cd8'] },
  { id: 'greenroom', name: 'Greenroom', swatch: ['#b9ecc8', '#ff7a00', '#1e40d6'] },
  { id: 'skyline', name: 'Skyline', swatch: ['#9fd6ff', '#e8131b', '#24206e'] },
] as const

export type PaletteId = (typeof palettes)[number]['id']

const STORAGE_KEY = 'bhs:palette:v2'
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const read = () => document.documentElement.dataset.theme as PaletteId

export function setPalette(id: PaletteId) {
  document.documentElement.dataset.theme = id
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Storage can be unavailable in private browsing; the palette still applies for this visit.
  }
  listeners.forEach((listener) => listener())
}

export const usePalette = () => useSyncExternalStore(subscribe, read)
