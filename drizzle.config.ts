import { defineConfig } from 'drizzle-kit'

// Only used by `bun run db:studio` to browse the local database. The app itself uses plain SQL.
export default defineConfig({
  dialect: 'sqlite',
  dbCredentials: { url: 'db/local.sqlite' },
})
