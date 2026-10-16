export type Category = 'people' | 'fictional' | 'animals' | 'objects'

export interface Fighter {
  id: string
  /** Display name including the headcount, e.g. "5 gorillas". */
  name: string
  /** Used mid-sentence, e.g. "the gorillas". */
  shortName: string
  category: Category
  /** How many of them are fighting together. */
  count: number
  emoji?: string
  imageUrl?: string
  /** Weight of one individual. */
  weightKg: number
  /** Body stats are only set for real people, for the "where do I rank" ladder. */
  heightCm?: number
  age?: number
  secretWeapon: string
  weakness: string
}

export interface RankedFighter extends Fighter {
  elo: number
  wins: number
  losses: number
  /** Places moved since last week. Positive means up. */
  rankChange: number
}

export interface Matchup {
  id: string
  left: Fighter
  right: Fighter
  /** Head-to-head votes so far, so the result can be shown the instant someone votes. */
  leftVotes: number
  rightVotes: number
}

export interface VoteRequest {
  matchupId: string
  winnerId: string
}

export interface ClosestCall {
  left: Fighter
  right: Fighter
  leftVotes: number
  rightVotes: number
}

export interface Rankings {
  totalVotes: number
  fighters: RankedFighter[]
  closestCalls: ClosestCall[]
}

/**
 * Proposed REST contract for the Java backend:
 *
 *   GET  /api/matchups?count=5           -> Matchup[]
 *   POST /api/votes        VoteRequest   -> 204 No Content
 *   GET  /api/rankings?category=animals  -> Rankings   (omit category for everyone)
 */
export interface BackhandApi {
  getMatchups(count: number): Promise<Matchup[]>
  vote(request: VoteRequest): Promise<void>
  getRankings(category?: Category): Promise<Rankings>
}
