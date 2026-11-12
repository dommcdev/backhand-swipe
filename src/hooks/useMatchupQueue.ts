import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { matchupQueueQuery } from '../api/queries'
import type { Matchup } from '../api/types'

const MIN_QUEUED = 3
const BATCH_SIZE = 5

/** Keeps a few upcoming matchups loaded so there is always a next fight the instant you vote. */
export function useMatchupQueue() {
  const queryClient = useQueryClient()
  const [items, setItems] = useState(() => queryClient.getQueryData<Matchup[]>(matchupQueueQuery.queryKey) ?? [])
  const [error, setError] = useState<Error | null>(null)
  const loading = useRef(false)

  useEffect(() => {
    queryClient.setQueryData(matchupQueueQuery.queryKey, items)
  }, [items, queryClient])

  useEffect(() => {
    if (items.length >= MIN_QUEUED || error || loading.current) return
    loading.current = true
    api
      .getMatchups(BATCH_SIZE)
      .then((batch) =>
        setItems((current) => {
          const seen = new Set(current.map((m) => m.id))
          return [...current, ...batch.filter((m) => !seen.has(m.id) && seen.add(m.id))]
        }),
      )
      .catch(setError)
      .finally(() => {
        loading.current = false
      })
  }, [items.length, error])

  // Warm the image cache so the next fight shows up with its pictures already loaded.
  useEffect(() => {
    for (const m of items.slice(1)) {
      for (const f of [m.left, m.right]) if (f.imageUrl) new Image().src = f.imageUrl
    }
  }, [items])

  return {
    current: items[0] as Matchup | undefined,
    error,
    next: () => setItems((current) => current.slice(1)),
    retry: () => setError(null),
  }
}
