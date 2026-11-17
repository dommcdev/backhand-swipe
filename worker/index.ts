import { refitRatings, refreshClosestCalls, takeSnapshot } from './api'
import { handleApi } from './app'

/** Must match the crons in wrangler.jsonc. */
const NIGHTLY = '0 0 * * *'

export default {
  fetch: (request, env, ctx) => handleApi(request, env.DB, ctx),

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
