import { api } from './client'
import type { Category } from './types'

export const categories: Category[] = ['people', 'fictional', 'animals', 'objects']

export const categoryLabels: Record<Category, string> = {
  people: 'People',
  fictional: 'Fictional',
  animals: 'Animals',
  objects: 'Objects',
}

export const rankingsQuery = (category?: Category) => ({
  queryKey: ['rankings', category ?? 'all'],
  queryFn: () => api.getRankings(category),
})

/** Upcoming matchups. The vote page keeps this in sync so the deck survives navigation. */
export const matchupQueueQuery = {
  queryKey: ['matchups', 'queue'],
  queryFn: () => api.getMatchups(5),
}
