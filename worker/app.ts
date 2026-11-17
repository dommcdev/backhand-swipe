import type { Category } from '../src/api/types'
import { BadRequest, getMatchups, getRankings, getRoster, vote } from './api'

const noStore = { 'Cache-Control': 'no-store' }
/** The roster reads every fighter, so each Cloudflare location reuses it for this long. */
const ROSTER_MAX_AGE = 300

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
    const rankings = await getRankings(db, {
      category: (params.get('category') ?? undefined) as Category | undefined,
      search: params.get('q') ?? undefined,
      offset: Number(params.get('offset') ?? 0),
    })
    return Response.json(rankings, { headers: noStore })
  }
  if (url.pathname === '/api/roster' && method === 'GET') {
    const cache = caches.default
    const key = new Request(url.origin + url.pathname)
    const hit = await cache.match(key)
    if (hit) return hit
    const response = Response.json(await getRoster(db), {
      headers: { 'Cache-Control': `public, max-age=${ROSTER_MAX_AGE}` },
    })
    ctx.waitUntil(cache.put(key, response.clone()))
    return response
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
