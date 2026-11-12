import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { matchupQueueQuery } from '../api/queries'
import type { Matchup } from '../api/types'

const MIN_QUEUED = 3
const BATCH_SIZE = 5

let nextKey = 0
const queued = (matchup: Matchup): QueuedMatchup => ({ key: nextKey++, matchup, leaving: false })

export interface QueuedMatchup {
  key: number
  matchup: Matchup
  /** Decided and animating off screen; no longer counts toward the deck. */
  leaving: boolean
}

/**
 * Keeps a few upcoming matchups loaded so the deck never runs dry. Items stay in arrival order,
 * including ones that are leaving, so cards never change DOM position mid-animation.
 */
export function useMatchupQueue() {
  const queryClient = useQueryClient()
  const [items, setItems] = useState(() =>
    (queryClient.getQueryData<Matchup[]>(matchupQueueQuery.queryKey) ?? []).map(queued),
  )
  const [error, setError] = useState<Error | null>(null)
  const loading = useRef(false)

  const activeCount = items.filter((i) => !i.leaving).length

  useEffect(() => {
    queryClient.setQueryData(
      matchupQueueQuery.queryKey,
      items.filter((i) => !i.leaving).map((i) => i.matchup),
    )
  }, [items, queryClient])

  useEffect(() => {
    if (activeCount >= MIN_QUEUED || error || loading.current) return
    loading.current = true
    api
      .getMatchups(BATCH_SIZE)
      .then((batch) =>
        setItems((current) => {
          const seen = new Set(current.filter((i) => !i.leaving).map((i) => i.matchup.id))
          const fresh = batch.filter((m) => !seen.has(m.id) && seen.add(m.id))
          return [...current, ...fresh.map(queued)]
        }),
      )
      .catch(setError)
      .finally(() => {
        loading.current = false
      })
  }, [activeCount, error])

  return {
    items,
    error,
    markLeaving: (key: number) => setItems((current) => current.map((i) => (i.key === key ? { ...i, leaving: true } : i))),
    remove: (key: number) => setItems((current) => current.filter((i) => i.key !== key)),
    retry: () => setError(null),
  }
}
