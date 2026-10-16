import { winChance } from '../lib/elo'
import { seedFighters } from './mockData'
import type { BackhandApi, ClosestCall, Matchup, RankedFighter, Rankings } from './types'

// In-memory stand-in for the backend. Votes are kept until the page reloads.

const K_FACTOR = 24

/** Deterministic pseudo-random number in [0, 1) so seed data is stable across reloads. */
function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const fighters = new Map<string, RankedFighter>(
  seedFighters.map((f) => {
    const fights = Math.round(5000 + hash(f.id) * 15000)
    const wins = Math.round(fights * (0.5 + (winChance(f.elo, 1200) - 0.5) * 0.7))
    const rankChange = Math.round(hash(`${f.id}:move`) * 8) - 3
    return [f.id, { ...f, wins, losses: fights - wins, rankChange }]
  }),
)

const pairKey = (a: string, b: string) => (a < b ? `${a}~${b}` : `${b}~${a}`)

/** Head-to-head votes for each pairing, stored in pairKey order. */
const pairs = new Map<string, [number, number]>()
for (const a of fighters.values()) {
  for (const b of fighters.values()) {
    const key = pairKey(a.id, b.id)
    if (a.id === b.id || pairs.has(key)) continue
    const [first, second] = a.id < b.id ? [a, b] : [b, a]
    const share = 0.5 + (winChance(first.elo, second.elo) - 0.5) * 0.8 + (hash(key) - 0.5) * 0.12
    const total = Math.round(150 + hash(`${key}:n`) * 2500)
    const firstVotes = Math.round(total * Math.min(0.97, Math.max(0.03, share)))
    pairs.set(key, [firstVotes, total - firstVotes])
  }
}

let totalVotes = 412_880

function votesFor(leftId: string, rightId: string) {
  const [first, second] = pairs.get(pairKey(leftId, rightId))!
  return leftId < rightId ? [first, second] : [second, first]
}

function strip({ elo: _elo, wins: _wins, losses: _losses, rankChange: _rankChange, ...fighter }: RankedFighter) {
  return fighter
}

function randomMatchup(): Matchup {
  const pool = [...fighters.values()]
  const left = pool[Math.floor(Math.random() * pool.length)]
  let right = left
  while (right.id === left.id) right = pool[Math.floor(Math.random() * pool.length)]
  const [leftVotes, rightVotes] = votesFor(left.id, right.id)
  return { id: `${left.id}~${right.id}`, left: strip(left), right: strip(right), leftVotes, rightVotes }
}

export const mockApi: BackhandApi = {
  async getMatchups(count) {
    return Array.from({ length: count }, randomMatchup)
  },

  async vote({ matchupId, winnerId }) {
    const [leftId, rightId] = matchupId.split('~')
    const left = fighters.get(leftId)
    const right = fighters.get(rightId)
    if (!left || !right || (winnerId !== leftId && winnerId !== rightId)) {
      throw new Error(`Unknown matchup ${matchupId}`)
    }

    const leftScore = winnerId === leftId ? 1 : 0
    const delta = Math.round(K_FACTOR * (leftScore - winChance(left.elo, right.elo)))
    left.elo += delta
    right.elo -= delta
    const [winner, loser] = leftScore ? [left, right] : [right, left]
    winner.wins++
    loser.losses++

    const key = pairKey(leftId, rightId)
    pairs.get(key)![winnerId === key.split('~')[0] ? 0 : 1]++
    totalVotes++
  },

  async getRankings(category): Promise<Rankings> {
    const list = [...fighters.values()]
      .filter((f) => !category || f.category === category)
      .sort((a, b) => b.elo - a.elo)

    const calls: ClosestCall[] = []
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [leftVotes, rightVotes] = votesFor(list[i].id, list[j].id)
        calls.push({ left: strip(list[i]), right: strip(list[j]), leftVotes, rightVotes })
      }
    }
    const closeness = (c: ClosestCall) => Math.abs(c.leftVotes / (c.leftVotes + c.rightVotes) - 0.5)
    const closestCalls = calls
      .filter((c) => c.leftVotes + c.rightVotes > 800)
      .sort((a, b) => closeness(a) - closeness(b))
      .slice(0, 3)

    // Copies, so cached query data never shares objects with this mutable store.
    return { totalVotes, fighters: list.map((f) => ({ ...f })), closestCalls }
  },
}
