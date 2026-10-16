import { NavLink } from 'react-router'

const tabs = [
  { to: '/', label: 'Vote', short: 'Vote', activeColor: 'group-aria-[current=page]:bg-vote', icon: <CardsIcon /> },
  { to: '/rankings', label: 'Rankings', short: 'Rankings', activeColor: 'group-aria-[current=page]:bg-rank', icon: <PodiumIcon /> },
  {
    to: '/where-do-i-rank',
    label: 'Where do I rank?',
    short: 'Rank me',
    activeColor: 'group-aria-[current=page]:bg-me',
    icon: <PersonIcon />,
  },
]

/** The three sections as menu bars. The current one turns white and its icon block takes the section color. */
export function NavTabs({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="Sections" className={`flex gap-2.5 md:gap-3 ${className}`}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          aria-label={tab.label}
          className="group press flex h-[52px] min-w-0 flex-1 items-stretch rounded-xl bg-white/12 text-white no-underline shadow-lift-sm hover:bg-white/20 aria-[current=page]:bg-white aria-[current=page]:text-black md:h-12 md:flex-none"
        >
          <span
            className={`cut grid w-11 shrink-0 place-items-center rounded-l-xl bg-black/45 group-aria-[current=page]:stripes md:w-[52px] ${tab.activeColor}`}
          >
            <span className="size-[22px] md:size-6">{tab.icon}</span>
          </span>
          <span className="flex min-w-0 items-center pr-3 pl-1.5 text-[.875rem] font-black whitespace-nowrap italic md:pr-4 md:pl-2 md:text-[1.05rem]">
            <span className="md:hidden">{tab.short}</span>
            <span className="hidden md:inline">{tab.label}</span>
          </span>
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
