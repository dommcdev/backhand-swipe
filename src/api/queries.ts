import { infiniteQueryOptions } from '@tanstack/react-query'
import { api } from './client'
import type { Category } from './types'

export const categories: Category[] = ['people', 'fictional', 'animals', 'objects']

export const categoryLabels: Record<Category, string> = {
  people: 'People',
  fictional: 'Fictional',
  animals: 'Animals',
  objects: 'Objects',
}

/** Standings, a page at a time. */
export const rankingsQuery = (category?: Category, search = '') =>
  infiniteQueryOptions({
    queryKey: ['rankings', category ?? 'all', search],
    queryFn: ({ pageParam }) => api.getRankings({ category, search, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  })

/** Every fighter, for the "where do I rank" ladder. The server caches it for a few minutes. */
export const rosterQuery = {
  queryKey: ['roster'],
  queryFn: () => api.getRoster(),
  staleTime: 5 * 60_000,
}

/** Upcoming matchups. The vote page keeps this in sync so the deck survives navigation. */
export const matchupQueueQuery = {
  queryKey: ['matchups', 'queue'],
  queryFn: () => api.getMatchups(5),
}
