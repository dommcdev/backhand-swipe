import { createClient, type InStatement } from '@libsql/client'
import { parse } from 'csv-parse/sync'
import { readFileSync } from 'node:fs'

// Usage:
//   bun run db:migrate                     create any missing tables
//   bun run db:import <file.csv> [--prune] add or update fighters from a CSV
//   bun run db:reset [--yes]               delete everything and recreate the tables
//
// Connects to TURSO_DATABASE_URL with TURSO_AUTH_TOKEN, read from backend/.env. To target another
// database, pass an env file: bun --env-file=.env.production run db:import fighters.csv

const url = process.env.TURSO_DATABASE_URL
if (!url) {
  console.error('TURSO_DATABASE_URL is not set. Copy .env.example to .env.')
  process.exit(1)
}
const isLocal = /^(http|ws)s?:\/\/(127\.0\.0\.1|localhost)|^file:/.test(url)
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined })
console.log(`Database: ${url}`)

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')
const migrate = () => db.executeMultiple(schema)

const COLUMNS = [
  'fighter_id',
  'name',
  'short_name',
  'category',
  'quantity',
  'emoji',
  'image_url',
  'weight_kg',
  'height_cm',
  'age',
  'secret_weapon',
  'weakness',
  'elo',
] as const
type Column = (typeof COLUMNS)[number]
type Value = string | number | null

const CATEGORIES = ['people', 'fictional', 'animals', 'objects']
const REQUIRED: Column[] = ['fighter_id', 'name', 'short_name', 'category', 'weight_kg', 'secret_weapon', 'weakness']
const INTEGERS: Column[] = ['quantity', 'height_cm', 'age', 'elo']
const DEFAULTS: Partial<Record<Column, number>> = { quantity: 1, elo: 1000 }

/** Turns one CSV record into column values, or a list of everything wrong with it. */
function toFighter(record: Record<string, string>): { values: Record<Column, Value>; errors: string[] } {
  const errors: string[] = []
  const values = {} as Record<Column, Value>

  for (const column of COLUMNS) {
    const raw = record[column] ?? ''
    if (raw === '') {
      if (REQUIRED.includes(column)) errors.push(`${column} is required`)
      values[column] = DEFAULTS[column] ?? null
    } else if (column === 'weight_kg' || INTEGERS.includes(column)) {
      const n = Number(raw)
      if (!Number.isFinite(n) || n < 0) errors.push(`${column} "${raw}" is not a valid number`)
      else if (INTEGERS.includes(column) && !Number.isInteger(n)) errors.push(`${column} "${raw}" must be a whole number`)
      values[column] = n
    } else {
      values[column] = raw
    }
  }

  if (values.fighter_id && !/^[a-z0-9-]+$/.test(values.fighter_id as string)) {
    errors.push(`fighter_id "${values.fighter_id}" should only use lowercase letters, digits, and dashes`)
  }
  if (values.category && !CATEGORIES.includes(values.category as string)) {
    errors.push(`category "${values.category}" must be one of ${CATEGORIES.join(', ')}`)
  }
  if (values.weight_kg === 0) errors.push('weight_kg must be more than 0')
  if (values.quantity === 0) errors.push('quantity must be at least 1')
  return { values, errors }
}

async function importCsv(path: string, prune: boolean) {
  const records: Record<string, string>[] = parse(readFileSync(path), {
    columns: true,
    bom: true,
    trim: true,
    skip_empty_lines: true,
  })

  const headers = Object.keys(records[0] ?? {})
  const missing = COLUMNS.filter((c) => !headers.includes(c))
  const unknown = headers.filter((h) => !(COLUMNS as readonly string[]).includes(h))
  if (missing.length || unknown.length) {
    if (missing.length) console.error(`Missing columns: ${missing.join(', ')}`)
    if (unknown.length) console.error(`Unknown columns: ${unknown.join(', ')}`)
    console.error(`Expected the header row to be:\n${COLUMNS.join(',')}`)
    process.exit(1)
  }

  const fighters: Record<Column, Value>[] = []
  const seen = new Map<string, number>()
  const problems: string[] = []
  records.forEach((record, i) => {
    const line = i + 2
    const { values, errors } = toFighter(record)
    const id = values.fighter_id as string
    if (seen.has(id)) errors.push(`fighter_id "${id}" is also used on line ${seen.get(id)}`)
    seen.set(id, line)
    for (const error of errors) problems.push(`  line ${line}: ${error}`)
    fighters.push(values)
  })
  if (problems.length) {
    console.error(`Nothing was imported. Fix these in ${path}:\n${problems.join('\n')}`)
    process.exit(1)
  }

  await migrate()
  const ids = fighters.map((f) => f.fighter_id as string)
  const existing = new Set((await db.execute('SELECT fighter_id FROM fighter')).rows.map((r) => r.fighter_id as string))
  const stale = [...existing].filter((id) => !seen.has(id))

  const statements: InStatement[] = fighters.map((args) => ({
    sql: `
      INSERT INTO fighter (${COLUMNS.join(', ')})
      VALUES (${COLUMNS.map((c) => `:${c}`).join(', ')})
      ON CONFLICT (fighter_id) DO UPDATE SET
        name          = excluded.name,
        short_name    = excluded.short_name,
        category      = excluded.category,
        quantity      = excluded.quantity,
        emoji         = excluded.emoji,
        image_url     = excluded.image_url,
        weight_kg     = excluded.weight_kg,
        height_cm     = excluded.height_cm,
        age           = excluded.age,
        secret_weapon = excluded.secret_weapon,
        weakness      = excluded.weakness
    `,
    args,
  }))
  if (prune && stale.length) {
    statements.push({
      sql: `DELETE FROM fighter WHERE fighter_id NOT IN (SELECT value FROM json_each(:ids))`,
      args: { ids: JSON.stringify(ids) },
    })
  }
  statements.push(
    // One matchup for every pair of fighters. OR IGNORE skips pairs that already exist.
    `INSERT OR IGNORE INTO matchup (fighter_a_id, fighter_b_id)
     SELECT a.fighter_id, b.fighter_id FROM fighter a JOIN fighter b ON a.fighter_id < b.fighter_id`,
    // Gives new fighters a starting point for the "This week" column.
    `INSERT OR IGNORE INTO fighter_rating_snapshot (snapshot_date, fighter_id, elo)
     SELECT date('now'), fighter_id, elo FROM fighter`,
  )
  await db.batch(statements, 'write')

  const added = ids.filter((id) => !existing.has(id)).length
  console.log(`Imported ${fighters.length} fighters: ${added} new, ${fighters.length - added} updated.`)
  if (stale.length) {
    console.log(
      prune
        ? `Deleted ${stale.length} fighters that aren't in the CSV, with their matchups and votes: ${stale.join(', ')}`
        : `${stale.length} fighters in the database aren't in the CSV and were left alone: ${stale.join(', ')}\n` +
            'Run again with --prune to delete them, along with their matchups and votes.',
    )
  }
}

const [command, ...args] = process.argv.slice(2)

if (command === 'migrate') {
  await migrate()
} else if (command === 'import' && args[0]) {
  await importCsv(args[0], args.includes('--prune'))
} else if (command === 'reset') {
  if (!isLocal && !args.includes('--yes')) {
    console.error('This deletes every fighter and vote in a remote database. Run again with --yes if you mean it.')
    process.exit(1)
  }
  await db.executeMultiple(`
    DROP TABLE IF EXISTS fighter_rating_snapshot;
    DROP TABLE IF EXISTS vote;
    DROP TABLE IF EXISTS matchup;
    DROP TABLE IF EXISTS fighter;
  `)
  await migrate()
} else {
  console.error('Usage: bun scripts/db.ts <migrate | import <file.csv> [--prune] | reset [--yes]>')
  process.exit(1)
}

const { rows } = await db.execute(`
  SELECT (SELECT count(*) FROM fighter) AS fighters,
         (SELECT count(*) FROM matchup) AS matchups,
         (SELECT count(*) FROM vote) AS votes
`)
console.log(`Now: ${rows[0].fighters} fighters, ${rows[0].matchups} matchups, ${rows[0].votes} votes`)
db.close()
