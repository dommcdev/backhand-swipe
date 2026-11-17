import { refitRatings, takeSnapshot } from './api'
import { handleApi } from './app'

/** Must match the daily cron in wrangler.jsonc. */
const DAILY = '0 0 * * *'

export default {
  fetch: (request, env) => handleApi(request, env.DB),

  async scheduled(controller, env) {
    await refitRatings(env.DB)
    if (controller.cron === DAILY) await takeSnapshot(env.DB)
  },
} satisfies ExportedHandler<Env>
