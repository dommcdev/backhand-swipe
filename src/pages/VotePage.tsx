import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { api } from '../api/client'
import type { Fighter, Matchup } from '../api/types'
import { PictureBox, ProgressBar } from '../components/win'
import { formatWeight, percent } from '../lib/format'
import { useMatchupQueue } from '../hooks/useMatchupQueue'
import { useUnits } from '../lib/units'

type Call = 'left' | 'right' | 'skip'

interface LastCall {
  matchup: Matchup
  call: Call
}

const SWIPE_DISTANCE = 70

const wins = (f: Fighter) => {
  const name = f.shortName.replace(/^the /, '')
  return `${name[0].toUpperCase()}${name.slice(1)} win${f.count > 1 ? '' : 's'}`
}

/** Head-to-head totals including the vote just cast. */
function tally({ matchup, call }: LastCall) {
  return {
    leftVotes: matchup.leftVotes + (call === 'left' ? 1 : 0),
    rightVotes: matchup.rightVotes + (call === 'right' ? 1 : 0),
  }
}

export function VotePage() {
  const { current, error, next, retry } = useMatchupQueue()
  const [last, setLast] = useState<LastCall | null>(null)
  const swipe = useRef<number | null>(null)
  const queryClient = useQueryClient()

  const vote = useMutation({
    mutationFn: api.vote,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['rankings'] }),
  })

  function decide(call: Call) {
    if (!current) return
    next()
    setLast({ matchup: current, call })
    if (call !== 'skip') {
      vote.mutate({ matchupId: current.id, winnerId: call === 'left' ? current.left.id : current.right.id })
    }
  }

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const call = ({ ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'skip' } as Record<string, Call>)[e.key]
    if (!call || e.altKey || (e.target as HTMLElement).closest('input, textarea, select, dialog, [role=menu]')) return
    e.preventDefault()
    decide(call)
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyDown(e)
    addEventListener('keydown', handler)
    return () => removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="vote">
      <div
        className="fighters"
        onPointerDown={(e) => (swipe.current = e.clientX)}
        onPointerUp={(e) => {
          if (swipe.current === null) return
          const dx = e.clientX - swipe.current
          swipe.current = null
          if (Math.abs(dx) > SWIPE_DISTANCE) decide(dx < 0 ? 'left' : 'right')
        }}
        onPointerCancel={() => (swipe.current = null)}
      >
        {current ? (
          <>
            <FighterBox legend="Fighter 1" fighter={current.left} />
            <span className="vs" aria-hidden="true">
              VS
            </span>
            <FighterBox legend="Fighter 2" fighter={current.right} />
          </>
        ) : error ? (
          <fieldset className="groupbox wide">
            <legend>Error</legend>
            <p>No fights loaded: {error.message}</p>
            <button type="button" className="btn" onClick={retry}>
              Retry
            </button>
          </fieldset>
        ) : (
          <p className="loading">Loading...</p>
        )}
      </div>

      <div className="pick-row">
        <button type="button" className="btn big" accessKey="1" disabled={!current} onClick={() => decide('left')}>
          &lt;-- <u>1</u>. {current ? wins(current.left) : 'Left wins'}
        </button>
        <button type="button" className="btn" accessKey="s" disabled={!current} onClick={() => decide('skip')}>
          <u>S</u>kip
        </button>
        <button type="button" className="btn big" accessKey="2" disabled={!current} onClick={() => decide('right')}>
          <u>2</u>. {current ? wins(current.right) : 'Right wins'} --&gt;
        </button>
      </div>

      <Result last={last} />
    </div>
  )
}

function FighterBox({ legend, fighter }: { legend: string; fighter: Fighter }) {
  const units = useUnits()
  return (
    <fieldset className="groupbox fighter">
      <legend>{legend}</legend>
      <PictureBox fighter={fighter} />
      <h2>{fighter.name}</h2>
      <dl>
        <dt>Total weight:</dt>
        <dd>{formatWeight(fighter.weightKg * fighter.count, units)}</dd>
        <dt>Secret weapon:</dt>
        <dd>{fighter.secretWeapon}</dd>
        <dt>Weakness:</dt>
        <dd>{fighter.weakness}</dd>
      </dl>
    </fieldset>
  )
}

function Result({ last }: { last: LastCall | null }) {
  if (!last || last.call === 'skip') {
    return (
      <fieldset className="groupbox result" aria-live="polite">
        <legend>Result</legend>
        <p>{last ? 'Skipped. That one doesn’t count.' : 'Pick a winner. You can also use the arrow keys or swipe.'}</p>
        <ProgressBar value={0} label="Voters who agree" />
        <p className="small">&nbsp;</p>
      </fieldset>
    )
  }

  const { leftVotes, rightVotes } = tally(last)
  const picked = last.call === 'left' ? last.matchup.left : last.matchup.right
  const agree = percent(last.call === 'left' ? leftVotes : rightVotes, leftVotes + rightVotes)
  const leftPct = percent(leftVotes, leftVotes + rightVotes)

  return (
    <fieldset className="groupbox result" aria-live="polite">
      <legend>Result</legend>
      <p>
        {agree >= 50
          ? `You and ${agree}% of voters backed ${picked.shortName}.`
          : `Only ${agree}% of voters backed ${picked.shortName} with you.`}
      </p>
      <ProgressBar value={agree} label="Voters who agree" />
      <p className="small">
        {last.matchup.left.name}: {leftPct}% &nbsp;|&nbsp; {last.matchup.right.name}: {100 - leftPct}%
      </p>
    </fieldset>
  )
}
