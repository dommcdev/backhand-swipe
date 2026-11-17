import type { Fighter } from '../api/types'
import { formatNumber } from '../lib/format'

const initials = (name: string) =>
  name
    .replace(/,.*$/, '')
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')

/**
 * Large art for the arena: one image, emoji, or monogram, with a ×N badge for groups.
 * Fills its parent, which must be positioned and sized, so every fighter gets the same box.
 */
export function FighterArt({ fighter }: { fighter: Fighter }) {
  let art: React.ReactNode
  if (fighter.imageUrl) {
    art = <img src={fighter.imageUrl} alt="" className="crowd absolute inset-0 size-full object-contain" draggable={false} />
  } else if (fighter.emoji) {
    art = <span className="crowd text-[5.5rem] leading-none">{fighter.emoji}</span>
  } else {
    art = (
      <span className="grid size-24 place-items-center rounded-full border-[3px] border-black bg-white text-4xl font-black text-black shadow-lift-sm">
        {initials(fighter.name)}
      </span>
    )
  }

  return (
    <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
      {art}
      {fighter.count > 1 && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 -rotate-4 rounded-lg border-2 border-white bg-black px-2.5 py-0.5 text-xl font-black whitespace-nowrap text-white italic shadow-lift-sm">
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
