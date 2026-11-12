import { createClient } from '@libsql/client'
import { handleApi } from '../src/app'

// Serves the same API as the Worker, but under Bun, which lets TURSO_DATABASE_URL be a local
// file like file:local.db. The deployed Worker can only reach Turso over HTTP.

const url = process.env.TURSO_DATABASE_URL
if (!url) {
  console.error('TURSO_DATABASE_URL is not set. Copy .env.example to .env.')
  process.exit(1)
}
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined })

const server = Bun.serve({ port: 8787, fetch: (request) => handleApi(request, db) })
console.log(`API on ${server.url} using ${url}`)
