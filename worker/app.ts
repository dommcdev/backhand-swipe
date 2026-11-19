import type { Category } from '../src/api/types'
import { BadRequest, createFighter, editFighter, getMatchups, getRankings, getRoster, listFighters, removeFighter, vote } from './api'

const noStore = { 'Cache-Control': 'no-store' }
/** The roster reads every fighter, so each Cloudflare location reuses it for this long. */
const ROSTER_MAX_AGE = 300
/** Rankings change with every vote, but a few seconds behind is fine, and it saves a read per visitor. */
const RANKINGS_MAX_AGE = 30

/** Serves `url` from this Cloudflare location's cache, or builds it and keeps it for `maxAge` seconds. */
async function cached(url: string, maxAge: number, ctx: ExecutionContext, build: () => Promise<unknown>) {
  const cache = caches.default
  const key = new Request(url)
  const hit = await cache.match(key)
  if (hit) return hit
  const response = Response.json(await build(), { headers: { 'Cache-Control': `public, max-age=${maxAge}` } })
  ctx.waitUntil(cache.put(key, response.clone()))
  return response
}

async function route(request: Request, db: D1Database, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url)
  const method = request.method

  if (url.pathname === '/api/matchups' && method === 'GET') {
    return Response.json(await getMatchups(db, Number(url.searchParams.get('count') ?? 5)), { headers: noStore })
  }
  if (url.pathname === '/api/votes' && method === 'POST') {
    await vote(db, await request.json().catch(() => null))
    return new Response(null, { status: 204 })
  }
  if (url.pathname === '/api/rankings' && method === 'GET') {
    const params = url.searchParams
    const request = {
      category: (params.get('category') ?? undefined) as Category | undefined,
      search: params.get('q') ?? undefined,
      offset: Number(params.get('offset') ?? 0),
    }
    // Searches are too varied to be worth caching.
    if (request.search?.trim()) return Response.json(await getRankings(db, request), { headers: noStore })
    const key = `${url.origin}${url.pathname}?category=${request.category ?? ''}&offset=${request.offset}`
    return cached(key, RANKINGS_MAX_AGE, ctx, () => getRankings(db, request))
  }
  if (url.pathname === '/api/roster' && method === 'GET') {
    return cached(url.origin + url.pathname, ROSTER_MAX_AGE, ctx, () => getRoster(db))
  }
  if (url.pathname === '/api/fighters' && method === 'GET') {
    return Response.json(await listFighters(db), { headers: noStore })
  }
  if (url.pathname === '/api/fighters' && method === 'POST') {
    return Response.json(await createFighter(db, await request.json().catch(() => null)), { status: 201 })
  }
  const fighterId = url.pathname.match(/^\/api\/fighters\/([^/]+)$/)?.[1]
  if (fighterId && method === 'PUT') {
    await editFighter(db, decodeURIComponent(fighterId), await request.json().catch(() => null))
    return new Response(null, { status: 204 })
  }
  if (fighterId && method === 'DELETE') {
    await removeFighter(db, decodeURIComponent(fighterId))
    return new Response(null, { status: 204 })
  }
  return Response.json({ error: 'Not found' }, { status: 404 })
}

/** Handles /api requests. Everything else is served from the built app before reaching the Worker. */
export async function handleApi(request: Request, db: D1Database, ctx: ExecutionContext): Promise<Response> {
  try {
    return await route(request, db, ctx)
  } catch (err) {
    if (err instanceof BadRequest) return Response.json({ error: err.message }, { status: 400 })
    console.error(JSON.stringify({ message: 'request failed', method: request.method, url: request.url, error: String(err) }))
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
