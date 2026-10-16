import { Link } from 'react-router'
import { NavTabs } from './NavTabs'

export function SiteHeader() {
  return (
    <header className="bg-black text-white">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-8 px-[18px] md:h-[84px] md:px-10">
        <Link to="/" className="flex items-center gap-2.5 text-inherit no-underline decoration-3 underline-offset-4 focus-visible:underline focus-visible:outline-none">
          <Emblem />
          <span className="text-[1.6rem] leading-none font-black tracking-[-.02em] italic md:text-[1.9rem]">
            Backhand Swipe
          </span>
        </Link>
        <NavTabs className="hidden md:flex" />
      </div>
    </header>
  )
}

/** A red and blue corner split by a slash, like a fighter's emblem. */
function Emblem() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="size-9 shrink-0 md:size-10">
      <circle cx="20" cy="20" r="18.5" fill="#fff" />
      <clipPath id="emblem">
        <circle cx="20" cy="20" r="15" />
      </clipPath>
      <g clipPath="url(#emblem)">
        <path d="M0 0h25L15 40H0z" fill="var(--corner-l)" />
        <path d="M25 0h15v40H15z" fill="var(--corner-r)" />
        <path d="M25-2 15 42" stroke="#fff" strokeWidth="4" />
      </g>
    </svg>
  )
}
