import type { BackhandApi, Matchup } from './types'

async function request(path: string, init?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `${init?.method ?? 'GET'} /api${path} returned ${res.status}`)
  }
  return res
}

/** Starts downloading fighter art as soon as a batch arrives, so cards further down the deck are ready in time. */
function preloadArt(matchups: Matchup[]) {
  for (const { left, right } of matchups) {
    for (const { imageUrl } of [left, right]) if (imageUrl) new Image().src = imageUrl
  }
  return matchups
}

export const api: BackhandApi = {
  getMatchups: (count) =>
    request(`/matchups?count=${count}`)
      .then((res) => res.json())
      .then(preloadArt),
  vote: (body) => request('/votes', { method: 'POST', body: JSON.stringify(body) }).then(() => undefined),
  getRankings: ({ category, search, offset }) => {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (search) params.set('q', search)
    if (offset) params.set('offset', String(offset))
    const query = params.toString()
    return request(query ? `/rankings?${query}` : '/rankings').then((res) => res.json())
  },
  getRoster: () => request('/roster').then((res) => res.json()),
  getFighters: () => request('/fighters').then((res) => res.json()),
  addFighter: (input) => request('/fighters', { method: 'POST', body: JSON.stringify(input) }).then((res) => res.json()),
  updateFighter: (id, input) =>
    request(`/fighters/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }).then(() => undefined),
  deleteFighter: (id) => request(`/fighters/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(() => undefined),
}
