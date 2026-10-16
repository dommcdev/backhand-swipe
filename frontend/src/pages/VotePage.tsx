import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { Fighter, Matchup } from '../api/types'
import { SwipeCard, type Call, type SwipeCardHandle } from '../components/SwipeCard'
import { percent } from '../lib/format'
import { useMatchupQueue, type QueuedMatchup } from '../hooks/useMatchupQueue'

interface LastCall {
  matchup: Matchup
  call: Call
}

/** Head-to-head totals including the vote just cast. */
function tally({ matchup, call }: LastCall) {
  return {
    leftVotes: matchup.leftVotes + (call === 'left' ? 1 : 0),
    rightVotes: matchup.rightVotes + (call === 'right' ? 1 : 0),
  }
}

function verdictText(last: LastCall | null) {
  if (!last) return 'Drag toward the winner, or use the arrow keys.'
  if (last.call === 'skip') return 'Skipped. That one doesn’t count.'

  const picked = last.call === 'left' ? last.matchup.left : last.matchup.right
  const { leftVotes, rightVotes } = tally(last)
  const agree = percent(last.call === 'left' ? leftVotes : rightVotes, leftVotes + rightVotes)
  return agree >= 50
    ? `You and ${agree}% of voters backed ${picked.shortName}.`
    : `Only ${agree}% of voters backed ${picked.shortName} with you.`
}

export function VotePage() {
  const { items, error, markLeaving, remove, retry } = useMatchupQueue()
  const [last, setLast] = useState<LastCall | null>(null)
  const topCard = useRef<SwipeCardHandle>(null)
  const deck = useRef<HTMLElement>(null)
  const queryClient = useQueryClient()

  const vote = useMutation({
    mutationFn: api.vote,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['rankings'] }),
  })

  function handleDecided({ key, matchup }: QueuedMatchup, call: Call) {
    markLeaving(key)
    setLast({ matchup, call })
    if (call !== 'skip') {
      vote.mutate({ matchupId: matchup.id, winnerId: call === 'left' ? matchup.left.id : matchup.right.id })
    }
  }

  useEffect(() => {
    const keys: Record<string, Call> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'skip' }
    function onKeyDown(e: KeyboardEvent) {
      const call = keys[e.key]
      if (!call || (e.target as HTMLElement).closest('input, textarea, select')) return
      e.preventDefault()
      topCard.current?.decide(call)
    }
    addEventListener('keydown', onKeyDown)
    return () => removeEventListener('keydown', onKeyDown)
  }, [])

  const active = items.filter((i) => !i.leaving)
  const current = active[0]?.matchup
  const visible = items.filter((i) => i.leaving || active.indexOf(i) < 3)

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2.5 gap-y-4 [grid-template-areas:'deck_deck_deck'_'left_skip_right'_'verdict_verdict_verdict'] lg:grid-cols-[1fr_440px_1fr] lg:gap-x-10 lg:[grid-template-areas:'left_deck_right'_'._skip_.'_'verdict_verdict_verdict']">
      <section
        ref={deck}
        aria-label="Matchups"
        className="relative h-[clamp(420px,calc(100dvh-390px),500px)] [grid-area:deck] lg:h-[500px]"
      >
        {visible.toReversed().map((item) => {
          const index = active.indexOf(item)
          return (
            <SwipeCard
              key={item.key}
              ref={index === 0 ? topCard : undefined}
              matchup={item.matchup}
              pos={item.leaving ? 'leaving' : (index as 0 | 1 | 2)}
              onDecided={(call) => handleDecided(item, call)}
              onExited={() => remove(item.key)}
              onDragProgress={(p) => deck.current?.style.setProperty('--drag', p.toFixed(3))}
            />
          )
        })}

        {!current && error && (
          <div className="absolute inset-x-0 top-0 bottom-7 flex flex-col items-center justify-center gap-3.5 rounded-[22px] border-[3px] border-black bg-card p-6 text-center shadow-lift">
            <h2 className="m-0 text-[2.2rem] leading-none font-black italic">No fights loaded</h2>
            <p className="m-0 max-w-[28ch] leading-snug">{error.message}</p>
            <button
              type="button"
              onClick={retry}
              className="press stripes rounded-xl border-[3px] border-black bg-vote px-5 py-2.5 shadow-lift-sm"
            >
              <span className="outlined text-xl font-black italic">Try again</span>
            </button>
          </div>
        )}
      </section>

      <PickButton side="left" fighter={current?.left} onPick={() => topCard.current?.decide('left')} />
      <button
        type="button"
        disabled={!current}
        onClick={() => topCard.current?.decide('skip')}
        className="press stripes max-w-[7.5ch] justify-self-center rounded-xl border-[3px] border-black bg-slate px-2.5 py-1.5 text-[.8125rem] leading-tight font-bold text-white shadow-lift-sm [grid-area:skip] lg:max-w-none lg:px-4 lg:py-2"
      >
        Can’t call it
      </button>
      <PickButton side="right" fighter={current?.right} onPick={() => topCard.current?.decide('right')} />

      <VerdictBar last={last} />
    </div>
  )
}

/** The verdict, written over the head-to-head split. Before the first vote and after a skip it is plain black. */
function VerdictBar({ last }: { last: LastCall | null }) {
  const { leftVotes, rightVotes } = last && last.call !== 'skip' ? tally(last) : { leftVotes: 0, rightVotes: 0 }
  const total = leftVotes + rightVotes
  const leftPct = total ? percent(leftVotes, total) : 50
  const shown = total ? '' : 'opacity-0'
  const pct = `outlined relative w-12 shrink-0 text-[1.05rem] font-black italic tabular-nums transition-opacity duration-300 lg:w-20 lg:text-[1.5rem] ${shown}`

  return (
    <section
      aria-live="polite"
      className="relative flex h-[4.5rem] items-center overflow-hidden rounded-2xl border-[3px] border-black bg-black px-3 shadow-lift-sm [grid-area:verdict] lg:h-[4.25rem] lg:px-5"
    >
      <div aria-hidden="true" className={`absolute inset-0 flex gap-1 transition-opacity duration-300 ${shown}`}>
        <span
          className="stripes bg-corner-l transition-[flex-basis] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ flexBasis: `${leftPct}%` }}
        />
        <span className="stripes grow bg-corner-r" />
      </div>
      <span aria-hidden="true" className={pct}>{leftPct}%</span>
      <p className="relative m-0 line-clamp-2 flex-1 text-center text-[.9375rem] leading-snug font-bold text-white [paint-order:stroke_fill] [-webkit-text-stroke:3px_#000] lg:text-[1.05rem]">
        {verdictText(last)}
      </p>
      <span aria-hidden="true" className={`${pct} text-right`}>{100 - leftPct}%</span>
    </section>
  )
}

interface PickButtonProps {
  side: 'left' | 'right'
  fighter?: Fighter
  onPick: () => void
}

function PickButton({ side, fighter, onPick }: PickButtonProps) {
  const isLeft = side === 'left'
  const long = (fighter?.name.length ?? 0) > 14

  return (
    <button
      type="button"
      disabled={!fighter}
      aria-label={fighter ? `${fighter.name} wins` : undefined}
      onClick={onPick}
      className={`press stripes flex h-16 items-center gap-1.5 rounded-2xl border-[3px] border-black px-2 shadow-lift-sm disabled:opacity-50 lg:h-[180px] lg:w-full lg:max-w-[250px] lg:flex-col lg:justify-between lg:p-5 lg:shadow-lift ${
        isLeft
          ? 'bg-corner-l text-left [grid-area:left] lg:items-start lg:justify-self-end'
          : 'flex-row-reverse bg-corner-r text-right [grid-area:right] lg:items-end lg:justify-self-start'
      }`}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-black text-white lg:size-12">
        <Chevron direction={side} />
      </span>
      <span
        className={`outlined leading-[1.1] font-black text-balance italic ${long ? 'text-[.9rem] lg:text-[1.5rem]' : 'text-[1.05rem] lg:text-[1.9rem]'}`}
      >
        {fighter?.name}
      </span>
    </button>
  )
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 lg:size-6">
      <path
        d={direction === 'left' ? 'M13 3 6 10l7 7' : 'm7 3 7 7-7 7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
