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
  /** Place in the list it came from: overall, or within its category when filtered. */
  rank: number
  /** Places moved since last week. Positive means up. */
  rankChange: number
}

export interface Matchup {
  /** The two fighter ids, smallest first, joined with "~". */
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

/** One page of the standings. */
export interface Rankings {
  totalVotes: number
  fighters: RankedFighter[]
  /** Pass as `offset` for the next page, or null when there are no more. */
  nextOffset: number | null
}

export interface RankingsRequest {
  category?: Category
  /** Fighters whose name contains this. */
  search?: string
  offset?: number
}

/**
 * REST contract, implemented in worker/app.ts:
 *
 *   GET  /api/matchups?count=5                            -> Matchup[]
 *   POST /api/votes        VoteRequest                    -> 204 No Content
 *   GET  /api/rankings?category=animals&q=bat&offset=50   -> Rankings     (all optional)
 *   GET  /api/roster                                      -> RankedFighter[]  (everyone, cached for a few minutes)
 */
export interface BackhandApi {
  getMatchups(count: number): Promise<Matchup[]>
  vote(request: VoteRequest): Promise<void>
  getRankings(request: RankingsRequest): Promise<Rankings>
  getRoster(): Promise<RankedFighter[]>
}
