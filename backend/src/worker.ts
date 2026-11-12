// Resolves to the HTTP-only build of the client under Wrangler, through the package's "workerd" export.
import { createClient } from '@libsql/client'
import { takeSnapshot } from './api'
import { handleApi } from './app'

const connect = (env: Env) => createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN || undefined })

export default {
  fetch: (request, env) => handleApi(request, connect(env)),

  async scheduled(_controller, env) {
    await takeSnapshot(connect(env))
  },
} satisfies ExportedHandler<Env>
