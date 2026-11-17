import { mkdir } from 'node:fs/promises'
import type { Matchup } from '../src/api/types.js'

// Local only: never consume production quotas or populate the live rankings with test votes.
const base = process.env.LOAD_URL ?? 'http://127.0.0.1:5173'
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)) throw new Error('Local URLs only')
const users = Number(process.env.LOAD_USERS ?? 100)
const seconds = Number(process.env.LOAD_SECONDS ?? 600)
const thinkMs = Number(process.env.LOAD_THINK_MS ?? 0)
if (![users, seconds].every((n) => Number.isInteger(n) && n > 0) || !Number.isFinite(thinkMs) || thinkMs < 0) {
  throw new Error('Invalid load settings')
}
const output = process.env.LOAD_OUTPUT ?? '/tmp/opencode/backhand-load'
await mkdir(output, { recursive: true })
type Stats = {
  requests: number; ok: number; errors: number; rowsRead: number; rowsWritten: number; queries: number;
  missingMetrics: number; statuses: Record<string, number>; latencies: number[]; samples: string[]
}
const endpoints: Record<string, Stats> = {}
const start = Date.now()
const deadline = start + seconds * 1000
let votes = 0
let emptyBatches = 0
async function request(path: string, body?: unknown) {
  const key = path.split('?')[0]
  const s = endpoints[key] ??= { requests: 0, ok: 0, errors: 0, rowsRead: 0, rowsWritten: 0, queries: 0,
    missingMetrics: 0, statuses: {}, latencies: [], samples: [] }
  s.requests++
  const at = performance.now()
  try {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    })
    const text = await response.text()
    s.statuses[response.status] = (s.statuses[response.status] ?? 0) + 1
    if (!response.headers.has('X-D1-Rows-Read')) s.missingMetrics++
    s.rowsRead += Number(response.headers.get('X-D1-Rows-Read'))
    s.rowsWritten += Number(response.headers.get('X-D1-Rows-Written'))
    s.queries += Number(response.headers.get('X-D1-Queries'))
    if (!response.ok) throw new Error(`${response.status}: ${text.slice(0, 300)}`)
    s.ok++
    return text ? JSON.parse(text) : null
  } catch (error) {
    s.errors++
    if (s.samples.length < 5) s.samples.push(String(error))
    return undefined
  } finally {
    s.latencies.push(performance.now() - at)
  }
}
function summary() {
  const stats = Object.fromEntries(Object.entries(endpoints).map(([key, s]) => {
    const sorted = [...s.latencies].sort((a, b) => a - b)
    const percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
    const { latencies: _, ...rest } = s
    return [key, { ...rest, latencyMs: { p50: percentile(.5), p95: percentile(.95), p99: percentile(.99) } }]
  }))
  const totals = Object.values(endpoints).reduce((a, s) => ({ requests: a.requests + s.requests,
    errors: a.errors + s.errors, rowsRead: a.rowsRead + s.rowsRead, rowsWritten: a.rowsWritten + s.rowsWritten }),
  { requests: 0, errors: 0, rowsRead: 0, rowsWritten: 0 })
  return { startedAt: new Date(start).toISOString(), elapsedSeconds: (Date.now() - start) / 1000,
    settings: { base, users, seconds, thinkMs, batchSize: 5 }, votes, emptyBatches, totals, endpoints: stats }
}
console.log(JSON.stringify({ event: 'start', ...summary() }))
const timer = setInterval(() => {
  const snapshot = summary()
  console.log(JSON.stringify({ event: 'progress', elapsedSeconds: snapshot.elapsedSeconds, votes, ...snapshot.totals }))
  void Bun.write(`${output}/progress.json`, JSON.stringify(snapshot, null, 2))
}, 30_000)
await Promise.all(Array.from({ length: users }, async () => {
  while (Date.now() < deadline) {
    const batch = await request('/api/matchups?count=5') as Matchup[] | undefined
    if (!batch?.length) {
      emptyBatches++
      await Bun.sleep(100)
      continue
    }
    for (const matchup of batch) {
      if (Date.now() >= deadline) break
      const result = await request('/api/votes', {
        matchupId: matchup.id, winnerId: Math.random() < .5 ? matchup.left.id : matchup.right.id,
      })
      if (result !== undefined) votes++
      if (thinkMs) await Bun.sleep(thinkMs)
    }
  }
}))
clearInterval(timer)
const result = summary()
await Bun.write(`${output}/results.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify({ event: 'complete', ...result }, null, 2))
