import type { Client, Row } from '@libsql/client'
import type { Category, ClosestCall, Fighter, Matchup, RankedFighter, Rankings, VoteRequest } from '../../frontend/src/api/types'
import { winChance } from '../../frontend/src/lib/elo'

export const categories: Category[] = ['people', 'fictional', 'animals', 'objects']

const K_FACTOR = 24
/** A head-to-head needs this many votes before it can show up as a closest call. */
const CLOSEST_CALL_MIN_VOTES = 5

export class BadRequest extends Error {}

const toFighter = (row: Row): Fighter => ({
  id: row.fighter_id as string,
  name: row.name as string,
  shortName: row.short_name as string,
  category: row.category as Category,
  count: row.quantity as number,
  emoji: (row.emoji as string | null) ?? undefined,
  imageUrl: (row.image_url as string | null) ?? undefined,
  weightKg: row.weight_kg as number,
  heightCm: (row.height_cm as number | null) ?? undefined,
  age: (row.age as number | null) ?? undefined,
  secretWeapon: row.secret_weapon as string,
  weakness: row.weakness as string,
})

export async function getMatchups(db: Client, count: number): Promise<Matchup[]> {
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new BadRequest('count must be from 1 to 20')

  // One row per fighter: two rows for each picked matchup. MATERIALIZED makes both halves
  // of the UNION see the same random picks.
  const { rows } = await db.execute({
    sql: `
      WITH picked AS MATERIALIZED (
        SELECT matchup_id, fighter_a_id, fighter_b_id FROM matchup ORDER BY random() LIMIT :count
      ),
      tally AS (
        SELECT p.matchup_id,
               count(v.vote_id) FILTER (WHERE v.winner_id = p.fighter_a_id) AS a_votes,
               count(v.vote_id) FILTER (WHERE v.winner_id = p.fighter_b_id) AS b_votes
        FROM picked p
        LEFT JOIN vote v ON v.matchup_id = p.matchup_id
        GROUP BY p.matchup_id
      )
      SELECT p.matchup_id, 'a' AS side, t.a_votes AS votes, f.*
      FROM picked p
      JOIN tally t ON t.matchup_id = p.matchup_id
      JOIN fighter f ON f.fighter_id = p.fighter_a_id
      UNION ALL
      SELECT p.matchup_id, 'b', t.b_votes, f.*
      FROM picked p
      JOIN tally t ON t.matchup_id = p.matchup_id
      JOIN fighter f ON f.fighter_id = p.fighter_b_id
    `,
    args: { count },
  })

  const sides = new Map<number, { fighter: Fighter; votes: number }[]>()
  for (const row of rows) {
    const id = row.matchup_id as number
    sides.set(id, [...(sides.get(id) ?? []), { fighter: toFighter(row), votes: row.votes as number }])
  }

  return [...sides].map(([id, pair]) => {
    const [left, right] = Math.random() < 0.5 ? pair : pair.toReversed()
    return { id, left: left.fighter, right: right.fighter, leftVotes: left.votes, rightVotes: right.votes }
  })
}

const isVoteRequest = (body: unknown): body is VoteRequest =>
  typeof body === 'object' &&
  body !== null &&
  'matchupId' in body &&
  Number.isInteger(body.matchupId) &&
  'winnerId' in body &&
  typeof body.winnerId === 'string'

export async function vote(db: Client, body: unknown) {
  if (!isVoteRequest(body)) throw new BadRequest('Expected { matchupId: number, winnerId: string }')
  const { matchupId, winnerId } = body

  const { rows } = await db.execute({
    sql: `
      SELECT m.fighter_a_id, m.fighter_b_id, a.elo AS a_elo, b.elo AS b_elo
      FROM matchup m
      JOIN fighter a ON a.fighter_id = m.fighter_a_id
      JOIN fighter b ON b.fighter_id = m.fighter_b_id
      WHERE m.matchup_id = :matchupId
    `,
    args: { matchupId },
  })
  const m = rows[0]
  if (!m || (winnerId !== m.fighter_a_id && winnerId !== m.fighter_b_id)) {
    throw new BadRequest(`${winnerId} is not in matchup ${matchupId}`)
  }

  const aScore = winnerId === m.fighter_a_id ? 1 : 0
  const delta = Math.round(K_FACTOR * (aScore - winChance(m.a_elo as number, m.b_elo as number)))

  // The ratings were read outside this write so votes never wait on each other. Both updates are
  // increments, so a vote that lands in between is never lost; at worst this delta is computed
  // from a rating that is a few milliseconds old.
  await db.batch(
    [
      { sql: 'INSERT INTO vote (matchup_id, winner_id) VALUES (:matchupId, :winnerId)', args: { matchupId, winnerId } },
      { sql: 'UPDATE fighter SET elo = elo + :delta WHERE fighter_id = :id', args: { delta, id: m.fighter_a_id } },
      { sql: 'UPDATE fighter SET elo = elo + :delta WHERE fighter_id = :id', args: { delta: -delta, id: m.fighter_b_id } },
    ],
    'write',
  )
}

export async function getRankings(db: Client, category?: Category): Promise<Rankings> {
  if (category !== undefined && !categories.includes(category)) throw new BadRequest(`Unknown category ${category}`)
  const only = category ?? null

  const [ranked, closest, total] = await db.batch(
    [
      {
        sql: `
          WITH scope AS (
            SELECT * FROM fighter WHERE :category IS NULL OR category = :category
          ),
          tally AS (
            SELECT m.fighter_a_id,
                   m.fighter_b_id,
                   count(*) FILTER (WHERE v.winner_id = m.fighter_a_id) AS a_votes,
                   count(*) FILTER (WHERE v.winner_id = m.fighter_b_id) AS b_votes
            FROM vote v
            JOIN matchup m ON m.matchup_id = v.matchup_id
            GROUP BY m.matchup_id
          ),
          record AS (
            SELECT fighter_id, sum(wins) AS wins, sum(losses) AS losses
            FROM (
              SELECT fighter_a_id AS fighter_id, a_votes AS wins, b_votes AS losses FROM tally
              UNION ALL
              SELECT fighter_b_id, b_votes, a_votes FROM tally
            )
            GROUP BY fighter_id
          ),
          last_week AS (
            SELECT s.fighter_id, row_number() OVER (ORDER BY s.elo DESC, s.fighter_id) AS place
            FROM fighter_rating_snapshot s
            JOIN scope ON scope.fighter_id = s.fighter_id
            WHERE s.snapshot_date = (
              SELECT min(snapshot_date) FROM fighter_rating_snapshot WHERE snapshot_date >= date('now', '-7 days')
            )
          )
          SELECT f.*,
                 coalesce(r.wins, 0) AS wins,
                 coalesce(r.losses, 0) AS losses,
                 coalesce(lw.place - row_number() OVER (ORDER BY f.elo DESC, f.fighter_id), 0) AS rank_change
          FROM scope f
          LEFT JOIN record r ON r.fighter_id = f.fighter_id
          LEFT JOIN last_week lw ON lw.fighter_id = f.fighter_id
          ORDER BY f.elo DESC, f.fighter_id
        `,
        args: { category: only },
      },
      {
        sql: `
          SELECT m.fighter_a_id,
                 m.fighter_b_id,
                 count(*) FILTER (WHERE v.winner_id = m.fighter_a_id) AS a_votes,
                 count(*) FILTER (WHERE v.winner_id = m.fighter_b_id) AS b_votes
          FROM vote v
          JOIN matchup m ON m.matchup_id = v.matchup_id
          JOIN fighter a ON a.fighter_id = m.fighter_a_id
          JOIN fighter b ON b.fighter_id = m.fighter_b_id
          WHERE :category IS NULL OR (a.category = :category AND b.category = :category)
          GROUP BY m.matchup_id
          HAVING count(*) >= :minVotes
          ORDER BY abs(a_votes - b_votes) * 1.0 / count(*), count(*) DESC
          LIMIT 3
        `,
        args: { category: only, minVotes: CLOSEST_CALL_MIN_VOTES },
      },
      'SELECT count(*) AS total FROM vote',
    ],
    'read',
  )

  const fighters: RankedFighter[] = ranked.rows.map((row) => ({
    ...toFighter(row),
    elo: row.elo as number,
    wins: row.wins as number,
    losses: row.losses as number,
    rankChange: row.rank_change as number,
  }))
  const byId = new Map(fighters.map((f) => [f.id, f]))
  const closestCalls: ClosestCall[] = closest.rows.map((row) => ({
    left: byId.get(row.fighter_a_id as string)!,
    right: byId.get(row.fighter_b_id as string)!,
    leftVotes: row.a_votes as number,
    rightVotes: row.b_votes as number,
  }))

  return { totalVotes: total.rows[0].total as number, fighters, closestCalls }
}

/** Records today's ratings. Only the first snapshot each day is kept, so "this week" compares against that. */
export async function takeSnapshot(db: Client) {
  await db.execute(`
    INSERT OR IGNORE INTO fighter_rating_snapshot (snapshot_date, fighter_id, elo)
    SELECT date('now'), fighter_id, elo FROM fighter
  `)
}
