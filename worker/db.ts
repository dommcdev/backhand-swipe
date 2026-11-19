// Every SQL query the app runs. Each function runs one query, or a few together as a transaction.

export interface FighterRow {
  fighter_id: string
  name: string
  short_name: string
  category: string
  quantity: number
  emoji: string | null
  image_url: string | null
  weight_kg: number
  height_cm: number | null
  age: number | null
  elo: number
  start_elo: number
  wins: number
  losses: number
}

export interface PairRow {
  fighter_a_id: string
  fighter_b_id: string
  a_wins: number
  b_wins: number
}

export interface RankedRow extends FighterRow {
  place: number
  last_rank: number | null
  last_category_rank: number | null
}

/** The editable columns of a fighter, used to add or edit one. */
export interface FighterValues {
  name: string
  short_name: string
  category: string
  quantity: number
  emoji: string | null
  weight_kg: number
  height_cm: number | null
  age: number | null
}

// ---------------------------------------------------------------------------------------------
// Fighters: create, read, update, delete

export async function addFighter(db: D1Database, id: string, f: FighterValues) {
  await db
    .prepare(
      `INSERT INTO fighter (fighter_id, name, short_name, category, quantity, emoji, weight_kg, height_cm, age)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, f.name, f.short_name, f.category, f.quantity, f.emoji, f.weight_kg, f.height_cm, f.age)
    .run()
}

export async function getFighter(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM fighter WHERE fighter_id = ?').bind(id).first<FighterRow>()
}

/** Every fighter, best rated first. */
export async function getAllFighters(db: D1Database) {
  const { results } = await db.prepare('SELECT * FROM fighter ORDER BY elo DESC, fighter_id').all<FighterRow>()
  return results
}

export async function updateFighter(db: D1Database, id: string, f: FighterValues) {
  await db
    .prepare(
      `UPDATE fighter
       SET name = ?, short_name = ?, category = ?, quantity = ?, emoji = ?, weight_kg = ?, height_cm = ?, age = ?
       WHERE fighter_id = ?`,
    )
    .bind(f.name, f.short_name, f.category, f.quantity, f.emoji, f.weight_kg, f.height_cm, f.age, id)
    .run()
}

/** ON DELETE CASCADE also deletes the fighter's votes, pairs, and snapshots. */
export async function deleteFighter(db: D1Database, id: string) {
  await db.prepare('DELETE FROM fighter WHERE fighter_id = ?').bind(id).run()
}

// ---------------------------------------------------------------------------------------------
// Matchmaking

export async function getMaxRowid(db: D1Database) {
  const row = await db.prepare('SELECT max(rowid) AS max_rowid FROM fighter').first<{ max_rowid: number | null }>()
  return row?.max_rowid ?? 0
}

/**
 * For each rowid, the first fighter at or after it. Called with random rowids to pick random fighters.
 * db.batch sends all the queries in one request, which is much faster than one request each.
 */
export async function getFightersAtRowids(db: D1Database, rowids: number[]) {
  const results = await db.batch<FighterRow>(
    rowids.map((rowid) => db.prepare('SELECT * FROM fighter WHERE rowid >= ? ORDER BY rowid LIMIT 1').bind(rowid)),
  )
  return results.flatMap((r) => r.results)
}

/** Fighters with the fewest votes. Only looks at fighters with under 10 votes. */
export async function getNewFighters(db: D1Database, limit: number) {
  const { results } = await db
    .prepare('SELECT * FROM fighter WHERE wins + losses < 10 ORDER BY wins + losses LIMIT ?')
    .bind(limit)
    .all<FighterRow>()
  return results
}

/** For each rating, the fighters rated just above and just below it. */
export async function getFightersNearRatings(db: D1Database, elos: number[], limit: number) {
  if (elos.length === 0) return []
  const results = await db.batch<FighterRow>(
    elos.flatMap((elo) => [
      db.prepare('SELECT * FROM fighter WHERE elo >= ? ORDER BY elo LIMIT ?').bind(elo, limit),
      db.prepare('SELECT * FROM fighter WHERE elo < ? ORDER BY elo DESC LIMIT ?').bind(elo, limit),
    ]),
  )
  return elos.map((_, i) => [...results[i * 2].results, ...results[i * 2 + 1].results])
}

/** The head-to-head totals for each pair of fighter ids. A pair that has never met has no row. */
export async function getPairs(db: D1Database, pairs: [string, string][]) {
  if (pairs.length === 0) return []
  const results = await db.batch<PairRow>(
    pairs.map(([aId, bId]) => db.prepare('SELECT * FROM pair WHERE fighter_a_id = ? AND fighter_b_id = ?').bind(aId, bId)),
  )
  return results.map((r) => r.results[0])
}

// ---------------------------------------------------------------------------------------------
// Votes

/** Saves a vote and updates both fighters and their head-to-head, all in one transaction. */
export async function addVote(db: D1Database, aId: string, bId: string, winnerId: string, aEloChange: number, bEloChange: number) {
  const aWon = winnerId === aId ? 1 : 0
  const bWon = 1 - aWon
  await db.batch([
    db.prepare('INSERT INTO vote (fighter_a_id, fighter_b_id, winner_id) VALUES (?, ?, ?)').bind(aId, bId, winnerId),
    db.prepare('INSERT OR IGNORE INTO pair (fighter_a_id, fighter_b_id) VALUES (?, ?)').bind(aId, bId),
    db
      .prepare('UPDATE pair SET a_wins = a_wins + ?, b_wins = b_wins + ? WHERE fighter_a_id = ? AND fighter_b_id = ?')
      .bind(aWon, bWon, aId, bId),
    db
      .prepare('UPDATE fighter SET elo = elo + ?, wins = wins + ?, losses = losses + ? WHERE fighter_id = ?')
      .bind(aEloChange, aWon, bWon, aId),
    db
      .prepare('UPDATE fighter SET elo = elo + ?, wins = wins + ?, losses = losses + ? WHERE fighter_id = ?')
      .bind(bEloChange, bWon, aWon, bId),
  ])
}

/** Vote ids only go up, so the highest one is the number of votes cast. */
export async function getVoteCount(db: D1Database) {
  const row = await db.prepare('SELECT max(vote_id) AS total FROM vote').first<{ total: number | null }>()
  return row?.total ?? 0
}

export async function getLatestVoteTime(db: D1Database) {
  const row = await db.prepare('SELECT created_at FROM vote ORDER BY vote_id DESC LIMIT 1').first<{ created_at: string }>()
  return row?.created_at ?? null
}

// ---------------------------------------------------------------------------------------------
// Rankings

/**
 * One page of the standings, optionally for one category and only names containing `search`.
 * `place` is the fighter's rank. `last_rank` and `last_category_rank` are from about a week ago.
 */
export async function getRankingsPage(db: D1Database, category: string | null, search: string, limit: number, offset: number) {
  const { results } = await db
    .prepare(
      `SELECT r.*, s.rank AS last_rank, s.category_rank AS last_category_rank
       FROM (
         SELECT *, row_number() OVER (ORDER BY elo DESC, fighter_id) AS place
         FROM fighter
         WHERE ?1 IS NULL OR category = ?1
       ) AS r
       LEFT JOIN fighter_rating_snapshot s
         ON s.fighter_id = r.fighter_id
         AND s.snapshot_date = (SELECT min(snapshot_date) FROM fighter_rating_snapshot)
       WHERE r.name LIKE '%' || ?2 || '%'
       ORDER BY r.place
       LIMIT ?3 OFFSET ?4`,
    )
    .bind(category, search, limit, offset)
    .all<RankedRow>()
  return results
}

/** Every fighter, best first, with their overall rank from about a week ago. */
export async function getRoster(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT f.*, s.rank AS last_rank
       FROM fighter f
       LEFT JOIN fighter_rating_snapshot s
         ON s.fighter_id = f.fighter_id
         AND s.snapshot_date = (SELECT min(snapshot_date) FROM fighter_rating_snapshot)
       ORDER BY f.elo DESC, f.fighter_id`,
    )
    .all<FighterRow & { last_rank: number | null }>()
  return results
}

// ---------------------------------------------------------------------------------------------
// Scheduled jobs

export async function getAllPairs(db: D1Database) {
  const { results } = await db.prepare('SELECT * FROM pair').all<PairRow>()
  return results
}

export async function setRatings(db: D1Database, ratings: { id: string; elo: number }[]) {
  const updates = ratings.map((r) => db.prepare('UPDATE fighter SET elo = ? WHERE fighter_id = ?').bind(r.elo, r.id))
  // D1 limits how many statements one batch can hold.
  for (let i = 0; i < updates.length; i += 500) await db.batch(updates.slice(i, i + 500))
}

/** Saves today's rank of every fighter, overall and within its category. scripts/db.ts has a copy. */
export const SNAPSHOT_SQL = `
  INSERT OR IGNORE INTO fighter_rating_snapshot (snapshot_date, fighter_id, elo, rank, category_rank)
  SELECT date('now'), fighter_id, elo,
         row_number() OVER (ORDER BY elo DESC, fighter_id),
         row_number() OVER (PARTITION BY category ORDER BY elo DESC, fighter_id)
  FROM fighter
`

/** Saves today's snapshot and deletes snapshots older than a week. */
export async function takeSnapshot(db: D1Database) {
  await db.batch([
    db.prepare(SNAPSHOT_SQL),
    db.prepare(`DELETE FROM fighter_rating_snapshot WHERE snapshot_date < date('now', '-7 days')`),
  ])
}
