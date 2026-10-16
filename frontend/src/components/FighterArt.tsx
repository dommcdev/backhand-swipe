import type { Fighter } from '../api/types'
import { formatNumber } from '../lib/format'

function crowdLayout(count: number) {
  if (count === 1) return { shown: 1, size: '5.6rem' }
  if (count <= 5) return { shown: count, size: '2.7rem' }
  if (count <= 100) return { shown: 15, size: '1.55rem' }
  return { shown: 24, size: '1.1rem' }
}

const initials = (name: string) =>
  name
    .replace(/,.*$/, '')
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')

/** Large art for the arena: an image, a crowd of emoji, or a monogram. */
export function FighterArt({ fighter }: { fighter: Fighter }) {
  if (fighter.imageUrl) {
    return <img src={fighter.imageUrl} alt="" className="crowd w-full max-w-[150px]" draggable={false} />
  }

  if (!fighter.emoji) {
    return (
      <span className="grid size-24 place-items-center rounded-full border-[3px] border-black bg-white text-4xl font-black text-black shadow-lift-sm">
        {initials(fighter.name)}
      </span>
    )
  }

  const { shown, size } = crowdLayout(fighter.count)
  return (
    <div className="relative flex w-full justify-center" aria-hidden="true">
      <div className="crowd flex flex-wrap justify-center gap-x-1 gap-y-0.5 leading-[1.05]" style={{ fontSize: size }}>
        {Array.from({ length: shown }, (_, i) => (
          <span key={i}>{fighter.emoji}</span>
        ))}
      </div>
      {fighter.count > shown && (
        <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 -rotate-4 rounded-lg border-2 border-white bg-black px-2 py-0.5 text-lg font-black whitespace-nowrap text-white italic">
          ×{formatNumber(fighter.count)}
        </span>
      )}
    </div>
  )
}

/** The fighter's image, emoji, or initials with no frame. Sized by the parent's font size. */
export function FighterGlyph({ fighter }: { fighter: Fighter }) {
  if (fighter.imageUrl) return <img src={fighter.imageUrl} alt="" className="w-[1.25em]" />
  if (fighter.emoji) return <>{fighter.emoji}</>
  return <span className="text-[.55em] font-black">{initials(fighter.name)}</span>
}

/** Small square avatar used in lists. */
export function FighterFace({ fighter }: { fighter: Fighter }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-black bg-white text-[1.7rem] leading-none text-black"
    >
      <FighterGlyph fighter={fighter} />
    </span>
  )
}

export function Monogram({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-10 shrink-0 place-items-center rounded-full border-2 border-black text-[.95rem] font-black ${className}`}
    >
      {initials(name)}
    </span>
  )
}

/** A round badge with a black and a white ring, like the art circle on a game's main menu. */
export function Medallion({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 rounded-full bg-black p-[5px] shadow-lift-sm ${className}`}>
      <span className="grid size-full rounded-full bg-white p-[3px]">
        <span className="grid size-full place-items-center rounded-full bg-panel leading-none text-fg">{children}</span>
      </span>
    </span>
  )
}
