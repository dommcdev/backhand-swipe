import type { BackhandApi, Matchup } from './types'

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
  getRankings: (category) =>
    request(category ? `/rankings?category=${category}` : '/rankings').then((res) => res.json()),
}
