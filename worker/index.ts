/// <reference types="vite/client" />
import { refitRatings } from './api'
import { handleApi } from './app'
import { takeSnapshot } from './db'
import { measureD1 } from './metrics'

export default {
  async fetch(request, env, ctx) {
    if (!import.meta.env.DEV) return handleApi(request, env.DB, ctx)
    const measured = measureD1(env.DB)
    // A copy, since responses from the cache can't have headers added.
    const original = await handleApi(request, measured.db, ctx)
    const response = new Response(original.body, original)
    response.headers.set('X-D1-Rows-Read', String(measured.totals.rowsRead))
    response.headers.set('X-D1-Rows-Written', String(measured.totals.rowsWritten))
    response.headers.set('X-D1-Queries', String(measured.totals.queries))
    return response
  },

  async scheduled(_controller, env) {
    // Refit first so the snapshot records the refit ratings.
    await refitRatings(env.DB, 24 * 60)
    await takeSnapshot(env.DB)
  },
} satisfies ExportedHandler<Env>
