import { mockApi } from './mock'
import type { BackhandApi } from './types'

async function request(path: string, init?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} /api${path} returned ${res.status}`)
  }
  return res
}

const liveApi: BackhandApi = {
  getMatchups: (count) => request(`/matchups?count=${count}`).then((res) => res.json()),
  vote: (body) => request('/votes', { method: 'POST', body: JSON.stringify(body) }).then(() => undefined),
  getRankings: (category) =>
    request(category ? `/rankings?category=${category}` : '/rankings').then((res) => res.json()),
}

export const api: BackhandApi = import.meta.env.VITE_API_MODE === 'live' ? liveApi : mockApi
