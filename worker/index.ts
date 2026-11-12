import { takeSnapshot } from './api'
import { handleApi } from './app'

export default {
  fetch: (request, env) => handleApi(request, env.DB),

  async scheduled(_controller, env) {
    await takeSnapshot(env.DB)
  },
} satisfies ExportedHandler<Env>
