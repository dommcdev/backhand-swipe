/// <reference types="vite/client" />
import { refitRatings, refreshClosestCalls, takeSnapshot } from './api'
import { handleApi } from './app'
import { measureD1 } from './metrics'

/** Must match the crons in wrangler.jsonc. */
const NIGHTLY = '0 0 * * *'

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

  async scheduled(controller, env) {
    if (controller.cron === NIGHTLY) {
      // Refit first so the snapshot records the refit ratings.
      await refitRatings(env.DB, 24 * 60)
      await takeSnapshot(env.DB)
      await refreshClosestCalls(env.DB)
    } else {
      await refreshClosestCalls(env.DB, 60)
    }
  },
} satisfies ExportedHandler<Env>
