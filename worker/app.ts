import type { Category } from '../src/api/types'
import { BadRequest, getMatchups, getRankings, vote } from './api'

const noStore = { 'Cache-Control': 'no-store' }

async function route(request: Request, db: D1Database): Promise<Response> {
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
    const category = (url.searchParams.get('category') ?? undefined) as Category | undefined
    return Response.json(await getRankings(db, category), { headers: noStore })
  }
  return Response.json({ error: 'Not found' }, { status: 404 })
}

/** Handles /api requests. Everything else is served from the built app before reaching the Worker. */
export async function handleApi(request: Request, db: D1Database): Promise<Response> {
  try {
    return await route(request, db)
  } catch (err) {
    if (err instanceof BadRequest) return Response.json({ error: err.message }, { status: 400 })
    console.error(JSON.stringify({ message: 'request failed', method: request.method, url: request.url, error: String(err) }))
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
