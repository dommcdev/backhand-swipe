import { parse } from 'csv-parse/sync'
import { readFileSync } from 'node:fs'

// Usage:
//   bun run db:migrate [--remote]                     create any missing tables
//   bun run db:import <file.csv> [--prune] [--remote] add or update fighters from a CSV
//   bun run db:reset [--remote --yes]                 delete everything and recreate the tables
//
// Works on the local D1 database that `bun run dev` uses, or the deployed one with --remote.
// Everything goes through `wrangler d1 execute`.

const remote = process.argv.includes('--remote')
console.log(`Database: ${remote ? 'remote (deployed)' : 'local'}`)

/** Runs SQL with wrangler and returns the rows of each statement. */
function sql(sql: string): Record<string, unknown>[][] {
  const proc = Bun.spawnSync(
    ['bunx', 'wrangler', 'd1', 'execute', 'DB', remote ? '--remote' : '--local', '--json', '--yes', `--command=${sql}`],
    { stderr: 'inherit' },
  )
  const out = proc.stdout.toString()
  if (!proc.success) {
    console.error(out)
    process.exit(1)
  }
  return (JSON.parse(out) as { results: Record<string, unknown>[] }[]).map((r) => r.results)
}

/** Writes a value as a SQL literal. The CSV is the only input and is validated first. */
const literal = (v: string | number | null) =>
  v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replaceAll("'", "''")}'`

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')
const migrate = () => sql(schema)

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

function importCsv(path: string, prune: boolean) {
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

  migrate()
  const ids = fighters.map((f) => f.fighter_id as string)
  const existing = new Set(sql('SELECT fighter_id FROM fighter')[0].map((r) => r.fighter_id as string))
  const stale = [...existing].filter((id) => !seen.has(id))

  const statements = fighters.map(
    (values) => `
      INSERT INTO fighter (${COLUMNS.join(', ')})
      VALUES (${COLUMNS.map((c) => literal(values[c])).join(', ')})
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
  )
  if (prune && stale.length) {
    statements.push(`DELETE FROM fighter WHERE fighter_id NOT IN (${ids.map(literal).join(', ')})`)
  }
  statements.push(
    // One matchup for every pair of fighters. OR IGNORE skips pairs that already exist.
    `INSERT OR IGNORE INTO matchup (fighter_a_id, fighter_b_id)
     SELECT a.fighter_id, b.fighter_id FROM fighter a JOIN fighter b ON a.fighter_id < b.fighter_id`,
    // Gives new fighters a starting point for the "This week" column.
    `INSERT OR IGNORE INTO fighter_rating_snapshot (snapshot_date, fighter_id, elo)
     SELECT date('now'), fighter_id, elo FROM fighter`,
  )
  sql(statements.join(';\n'))

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
const file = args.find((a) => !a.startsWith('--'))

if (command === 'migrate') {
  migrate()
} else if (command === 'import' && file) {
  importCsv(file, args.includes('--prune'))
} else if (command === 'reset') {
  if (remote && !args.includes('--yes')) {
    console.error('This deletes every fighter and vote in the deployed database. Run again with --yes if you mean it.')
    process.exit(1)
  }
  sql(`
    DROP TABLE IF EXISTS fighter_rating_snapshot;
    DROP TABLE IF EXISTS vote;
    DROP TABLE IF EXISTS matchup;
    DROP TABLE IF EXISTS fighter;
  `)
  migrate()
} else {
  console.error('Usage: bun scripts/db.ts <migrate | import <file.csv> [--prune] | reset [--yes]> [--remote]')
  process.exit(1)
}

const [[counts]] = sql(`
  SELECT (SELECT count(*) FROM fighter) AS fighters,
         (SELECT count(*) FROM matchup) AS matchups,
         (SELECT count(*) FROM vote) AS votes
`)
console.log(`Now: ${counts.fighters} fighters, ${counts.matchups} matchups, ${counts.votes} votes`)
