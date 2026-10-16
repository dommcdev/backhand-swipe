import { NavLink } from 'react-router'

const tabs = [
  { to: '/', label: 'Vote', short: 'Vote', color: 'bg-vote', icon: <CardsIcon /> },
  { to: '/rankings', label: 'Rankings', short: 'Rankings', color: 'bg-rank', icon: <PodiumIcon /> },
  { to: '/where-do-i-rank', label: 'Where do I rank?', short: 'Rank me', color: 'bg-me', icon: <PersonIcon /> },
]

/** The three sections as colored menu tiles. A white bar marks the current one. */
export function NavTabs({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="Sections" className={`flex gap-2.5 md:gap-3 ${className}`}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          aria-label={tab.label}
          className={`press stripes relative flex h-[58px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border-[3px] border-black text-white no-underline shadow-lift-sm after:absolute after:-top-3.5 after:left-1/2 after:h-1.5 after:w-9 after:-translate-x-1/2 after:rounded-full after:bg-white after:opacity-0 aria-[current=page]:after:opacity-100 md:h-[50px] md:flex-none md:-skew-x-10 md:flex-row md:px-5 md:after:top-auto md:after:-bottom-3.5 ${tab.color}`}
        >
          <span className="flex items-center gap-2 md:skew-x-10">
            <span className="size-6 drop-shadow-[0_2px_0_#000] md:size-[26px]">{tab.icon}</span>
            <span className="outlined hidden text-[1.3rem] font-black whitespace-nowrap italic md:block">{tab.label}</span>
          </span>
          <span className="outlined text-[.9rem] font-black italic md:hidden">{tab.short}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function CardsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full">
      <rect x="3" y="5" width="12" height="16" rx="2.5" fill="#fff" stroke="#000" strokeWidth="2" transform="rotate(-12 9 13)" />
      <rect x="9" y="3" width="12" height="16" rx="2.5" fill="#fff" stroke="#000" strokeWidth="2" transform="rotate(8 15 11)" />
    </svg>
  )
}

function PodiumIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full">
      <path d="M8.5 8h7v13h-7zM2 12.5h6.5V21H2zM15.5 15H22v6h-6.5z" fill="#fff" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
      <path d="m12 1.5 1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 7.5l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z" fill="#fff" stroke="#000" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full">
      <circle cx="10" cy="6.5" r="4" fill="#fff" stroke="#000" strokeWidth="2" />
      <path d="M2.5 21.5c0-4.6 3.3-8 7.5-8s7.5 3.4 7.5 8z" fill="#fff" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 3v18.5M18 6h2M18 10h2M18 14h2M18 18h2" fill="none" stroke="#000" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M20 3v18.5M18 6h2M18 10h2M18 14h2M18 18h2" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
