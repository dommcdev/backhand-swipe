import { useImperativeHandle, useRef, type Ref } from 'react'
import type { Fighter, Matchup } from '../api/types'
import { formatWeight } from '../lib/format'
import { FighterArt } from './FighterArt'

export type Call = 'left' | 'right' | 'skip'

export interface SwipeCardHandle {
  decide: (call: Call) => void
}

interface SwipeCardProps {
  matchup: Matchup
  /** 0 is the top card; 1 and 2 peek out behind it. */
  pos: 0 | 1 | 2 | 'leaving'
  /** Fires as soon as the call is made, so the next card can take over immediately. */
  onDecided: (call: Call) => void
  /** Fires once the card has finished animating off screen. */
  onExited: () => void
  /** 0 to 1 as the top card is dragged toward the swipe threshold. */
  onDragProgress: (progress: number) => void
  ref?: Ref<SwipeCardHandle>
}

const THRESHOLD = 110
const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const stampText = (f: Fighter) => `${f.shortName.replace(/^the /, '')} win${f.count > 1 ? '' : 's'}`

function nameSize(name: string) {
  if (name.length > 18) return 'text-[1.25rem]'
  if (name.length > 12) return 'text-[1.5rem]'
  return 'text-[1.85rem]'
}

export function SwipeCard({ matchup, pos, onDecided, onExited, onDragProgress, ref }: SwipeCardProps) {
  const cardRef = useRef<HTMLElement>(null)
  const drag = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0 })
  const leaving = useRef(false)
  const { left, right } = matchup
  const isTop = pos === 0

  function setLean(dx: number) {
    const card = cardRef.current!
    const p = Math.max(-1, Math.min(1, dx / THRESHOLD))
    card.style.setProperty('--lean-l', Math.max(0, -p).toFixed(3))
    card.style.setProperty('--lean-r', Math.max(0, p).toFixed(3))
  }

  function fling(call: Call, dy = 0) {
    const card = cardRef.current
    if (!card || leaving.current) return
    leaving.current = true
    const reduced = prefersReducedMotion()
    const dir = call === 'left' ? -1 : call === 'right' ? 1 : 0
    if (dir) setLean(dir * THRESHOLD)
    card.style.transition = reduced
      ? 'opacity .15s'
      : 'transform .5s cubic-bezier(.3,.6,.3,1), opacity .5s cubic-bezier(.5,0,.8,.4)'
    card.style.transform = dir
      ? `translate(${dir * (innerWidth * 0.6 + 260)}px, ${dy - 40}px) rotate(${dir * 28}deg)`
      : `translateY(${innerHeight * 0.7}px) rotate(-4deg)`
    card.style.opacity = '0'
    onDragProgress(0)
    onDecided(call)
    setTimeout(onExited, reduced ? 160 : 500)
  }

  useImperativeHandle(ref, () => ({ decide: (call) => fling(call) }))

  function handlePointerDown(e: React.PointerEvent<HTMLElement>) {
    if (leaving.current || e.button > 0) return
    drag.current = { active: true, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.style.transition = 'none'
  }

  function handlePointerMove(e: React.PointerEvent<HTMLElement>) {
    const d = drag.current
    if (!d.active) return
    d.dx = e.clientX - d.startX
    d.dy = e.clientY - d.startY
    e.currentTarget.style.transform = `translate(${d.dx}px, ${d.dy * 0.25}px) rotate(${d.dx / 16}deg)`
    setLean(d.dx)
    onDragProgress(Math.min(1, Math.abs(d.dx) / THRESHOLD))
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLElement>) {
    const d = drag.current
    if (!d.active) return
    d.active = false
    e.currentTarget.style.transition = ''
    if (Math.abs(d.dx) > THRESHOLD) {
      fling(d.dx < 0 ? 'left' : 'right', d.dy * 0.25)
    } else {
      e.currentTarget.style.transform = ''
      setLean(0)
      onDragProgress(0)
    }
  }

  const tape = [
    ['Total weight', formatWeight(left.weightKg * left.count), formatWeight(right.weightKg * right.count)],
    ['Secret weapon', left.secretWeapon, right.secretWeapon],
    ['Weakness', left.weakness, right.weakness],
  ]

  return (
    <article
      ref={cardRef}
      data-pos={pos}
      aria-label={`${left.name} versus ${right.name}`}
      aria-hidden={!isTop}
      inert={!isTop}
      onPointerDown={isTop ? handlePointerDown : undefined}
      onPointerMove={isTop ? handlePointerMove : undefined}
      onPointerUp={isTop ? handlePointerEnd : undefined}
      onPointerCancel={isTop ? handlePointerEnd : undefined}
      style={{ zIndex: pos === 'leaving' ? 4 : 3 - pos }}
      className="swipe-card absolute inset-x-0 top-0 bottom-7 flex touch-pan-y flex-col overflow-hidden rounded-[22px] border-[3px] border-black bg-card shadow-lift select-none data-[pos=0]:cursor-grab data-[pos=0]:active:cursor-grabbing"
    >
      <div className="relative min-h-[210px] flex-1 bg-black">
        <div className="corner corner-l stripes">
          <div className="flex flex-1 items-center justify-center">
            <FighterArt fighter={left} />
          </div>
          <h2 className={`outlined m-0 leading-[1.08] font-black text-balance italic ${nameSize(left.name)}`}>{left.name}</h2>
          <p className="stamp outlined m-0 first-letter:uppercase">{stampText(left)}</p>
        </div>
        <div className="corner corner-r stripes">
          <div className="flex flex-1 items-center justify-center">
            <FighterArt fighter={right} />
          </div>
          <h2 className={`outlined m-0 text-right leading-[1.08] font-black text-balance italic ${nameSize(right.name)}`}>
            {right.name}
          </h2>
          <p className="stamp outlined m-0 first-letter:uppercase">{stampText(right)}</p>
        </div>
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 z-1 grid size-[72px] -translate-1/2 rounded-full bg-black p-[5px]"
        >
          <span className="grid place-items-center rounded-full bg-[linear-gradient(115deg,#ff9a00,#ffe341)] ring-3 ring-white ring-inset">
            <span className="outlined pr-0.5 text-[1.6rem] leading-none font-black italic">VS</span>
          </span>
        </div>
      </div>

      <ul aria-label="Tale of the tape" className="card-body m-0 flex list-none flex-col gap-1.5 p-3">
        {tape.map(([stat, l, r]) => (
          <li
            key={stat}
            className="grid grid-cols-[1fr_auto_1fr] overflow-hidden rounded-lg border-2 border-line bg-panel text-[.875rem] leading-tight font-bold tabular-nums"
          >
            <span className="self-center px-2.5 py-[7px]">{l}</span>
            <span className="grid place-items-center bg-slate px-4 text-[.6875rem] font-semibold text-white [clip-path:polygon(9px_0,calc(100%-9px)_0,100%_100%,0_100%)]">
              {stat}
            </span>
            <span className="self-center px-2.5 py-[7px] text-right">{r}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}
