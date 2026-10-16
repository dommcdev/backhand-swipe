import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { categories, categoryLabels, rankingsQuery } from '../api/queries'
import type { Category, ClosestCall, RankedFighter } from '../api/types'
import { FighterFace, FighterGlyph, Medallion } from '../components/FighterArt'
import { SplitBar } from '../components/SplitBar'
import { formatNumber, percent } from '../lib/format'

const PAGE_SIZE = 25

const isCategory = (value: string | null): value is Category => categories.some((c) => c === value)

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .toLowerCase()

interface Row {
  fighter: RankedFighter
  rank: number
}

export function RankingsPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('category')
  const category = isCategory(raw) ? raw : undefined
  const [search, setSearch] = useState('')
  const query = normalize(useDeferredValue(search)).trim()

  const { data, error, refetch } = useQuery(rankingsQuery(category))

  if (!data) {
    return error ? (
      <div className="flex flex-col items-start gap-3">
        <p className="m-0 font-semibold">Rankings didn’t load: {error.message}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="press stripes rounded-xl border-[3px] border-black bg-rank px-4 py-2 shadow-lift-sm"
        >
          <span className="outlined font-black italic">Try again</span>
        </button>
      </div>
    ) : null
  }

  const rows: Row[] = data.fighters.map((fighter, i) => ({ fighter, rank: i + 1 }))
  const matches = query ? rows.filter((r) => normalize(r.fighter.name).includes(query)) : rows.slice(3)

  return (
    <>
      <div className="bg-page sticky top-0 z-10 -mx-[18px] -mt-3 flex flex-col gap-1 px-[18px] pt-3 pb-1 md:-mx-10 md:flex-row md:items-center md:justify-between md:gap-6 md:px-10">
        <SearchBox value={search} onChange={setSearch} />
        <div
          role="group"
          aria-label="Category"
          className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px] py-2.5 [scrollbar-width:none] md:mx-0 md:px-2"
        >
          {[undefined, ...categories].map((c) => (
            <button
              key={c ?? 'all'}
              type="button"
              aria-pressed={c === category}
              onClick={() => setParams(c ? { category: c } : {}, { replace: true })}
              className="press stripes h-11 shrink-0 rounded-xl border-[3px] border-black bg-slate px-4 text-[.95rem] font-black text-white italic shadow-lift-sm aria-pressed:bg-rank"
            >
              <span className={c === category ? 'outlined' : ''}>{c ? categoryLabels[c] : 'Everyone'}</span>
            </button>
          ))}
        </div>
      </div>

      {!query && (
        <>
          <Podium top={rows.slice(0, 3)} />
          {data.closestCalls.length > 0 && <ClosestCalls calls={data.closestCalls} />}
        </>
      )}

      <section aria-labelledby="standings" className="flex flex-col gap-3.5">
        <div className="mt-3 flex items-center justify-between gap-4">
          <SectionTitle id="standings">
            {query ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}` : 'Standings'}
          </SectionTitle>
          <p className="m-0 text-sm font-bold text-muted">{formatNumber(data.totalVotes)} votes cast</p>
        </div>

        {matches.length > 0 ? (
          <StandingsTable key={`${category}:${query}`} rows={matches} showCategory={!category} />
        ) : (
          <div className="flex flex-col items-start gap-3.5 rounded-2xl border-[3px] border-black bg-card p-5 shadow-lift-sm">
            <p className="m-0 text-2xl font-black italic">No fighters match “{search.trim()}”</p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="press stripes rounded-xl border-[3px] border-black bg-rank px-4 py-2 shadow-lift-sm"
            >
              <span className="outlined font-black italic">Clear search</span>
            </button>
          </div>
        )}
      </section>
    </>
  )
}

/** A black tab with slanted ends, like a menu breadcrumb. */
function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="m-0 ml-1.5 -skew-x-10 rounded-lg bg-black px-4 py-1.5 text-[1.35rem] leading-tight font-black text-white italic md:text-[1.6rem]">
      <span className="block skew-x-10">{children}</span>
    </h2>
  )
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="group flex h-[52px] w-full items-stretch rounded-xl border-[3px] border-black bg-card shadow-lift-sm md:max-w-md">
      <span className="segment grid w-14 shrink-0 place-items-center rounded-l-[9px] transition-colors group-focus-within:stripes group-focus-within:bg-rank">
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2.75" />
          <path d="m13 13 4.5 4.5" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" />
        </svg>
      </span>
      <span className="sr-only">Search fighters</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onChange('')}
        placeholder="Search fighters"
        autoComplete="off"
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-[1.05rem] font-bold text-fg outline-none placeholder:text-muted/70 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="mr-2.5 grid size-7 place-items-center self-center rounded-full bg-black text-sm font-black text-white hover:bg-rank focus-visible:bg-rank focus-visible:outline-none"
        >
          ×
        </button>
      )}
    </label>
  )
}

const medals = ['bg-[#ffc21a]', 'bg-[#b9c7d2]', 'bg-[#e8853d]']

function Podium({ top }: { top: Row[] }) {
  const [first, second, third] = top
  return (
    <ol aria-label="Top three" className="m-0 grid list-none grid-cols-3 items-end gap-2.5 p-0 pt-5 md:gap-6 md:pt-8">
      {first && <PodiumSpot row={first} champion />}
      {second && <PodiumSpot row={second} className="pt-6 md:pt-9" />}
      {third && <PodiumSpot row={third} className="pt-3 md:pt-5" />}
    </ol>
  )
}

function PodiumSpot({ row, champion, className = '' }: { row: Row; champion?: boolean; className?: string }) {
  const { fighter, rank } = row
  return (
    <li
      className={`stripes relative flex flex-col items-center gap-2 rounded-2xl border-[3px] border-black px-2 pb-3 text-center shadow-lift md:gap-3 md:px-4 md:pb-5 ${medals[rank - 1]} ${
        champion ? 'pt-4 md:pt-6' : className
      }`}
      style={{ order: rank === 1 ? 2 : rank === 2 ? 1 : 3 }}
    >
      <span className="outlined absolute -top-[18px] left-1/2 grid size-10 -translate-x-1/2 place-items-center rounded-full border-[3px] border-white bg-black text-xl font-black italic md:-top-6 md:size-12 md:text-2xl">
        {rank}
      </span>
      <Medallion
        className={`mt-3 ${champion ? 'size-[84px] text-[2.6rem] md:size-[132px] md:text-[4rem]' : 'size-16 text-[1.9rem] md:size-24 md:text-[2.9rem]'}`}
      >
        <FighterGlyph fighter={fighter} />
      </Medallion>
      <strong
        className={`outlined leading-[1.15] font-black text-balance italic ${champion ? 'text-[1.15rem] md:text-[2rem]' : 'text-base md:text-[1.6rem]'}`}
      >
        {fighter.name}
      </strong>
      <span className="rounded-full bg-black px-3 py-0.5 text-lg font-black text-white tabular-nums md:px-4 md:py-1 md:text-2xl">
        {formatNumber(fighter.elo)}
      </span>
    </li>
  )
}

function ClosestCalls({ calls }: { calls: ClosestCall[] }) {
  return (
    <section aria-labelledby="closest-calls" className="flex flex-col items-start gap-3.5 pt-3">
      <SectionTitle id="closest-calls">Closest calls</SectionTitle>
      <ul className="m-0 grid w-full list-none gap-3 p-0 md:grid-cols-3 md:gap-5">
        {calls.map((c) => (
          <li
            key={`${c.left.id}~${c.right.id}`}
            className="flex min-w-0 flex-col gap-2 rounded-2xl border-[3px] border-black bg-card p-3 shadow-lift-sm"
          >
            <div className="flex justify-between gap-4 text-[1.05rem] leading-[1.25] font-black italic">
              <span className="truncate text-corner-l">{c.left.name}</span>
              <span className="truncate text-right text-corner-r">{c.right.name}</span>
            </div>
            <SplitBar
              className="h-8"
              leftLabel={c.left.name}
              rightLabel={c.right.name}
              leftVotes={c.leftVotes}
              rightVotes={c.rightVotes}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Renders a page of rows at a time and adds more as the end scrolls into view. */
function StandingsTable({ rows, showCategory }: { rows: Row[]; showCategory: boolean }) {
  const [shown, setShown] = useState(PAGE_SIZE)
  const sentinel = useRef<HTMLDivElement>(null)
  const hasMore = shown < rows.length

  useEffect(() => {
    if (!hasMore) return
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setShown((n) => n + PAGE_SIZE),
      { rootMargin: '800px 0px' },
    )
    observer.observe(sentinel.current!)
    return () => observer.disconnect()
  }, [hasMore, shown])

  const columns =
    'grid grid-cols-[60px_44px_minmax(0,1fr)_auto] items-center gap-x-3 md:grid-cols-[76px_44px_minmax(0,1fr)_140px_160px_80px_96px] md:gap-x-4'

  return (
    <div className="flex flex-col gap-1.5">
      <div aria-hidden="true" className={`${columns} hidden rounded-xl bg-black py-2 pr-4 text-[.8125rem] font-bold text-white md:grid`}>
        <span className="text-center">Rank</span>
        <span className="col-span-2">Fighter</span>
        <span>Record</span>
        <span>Win rate</span>
        <span className="text-right">Rating</span>
        <span className="text-right">This week</span>
      </div>
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
        {rows.slice(0, shown).map(({ fighter: f, rank }) => {
          const winRate = percent(f.wins, f.wins + f.losses)
          return (
            <li
              key={f.id}
              className={`${columns} min-h-[62px] rounded-xl border-[3px] border-black bg-card pr-3.5 shadow-lift-sm md:pr-4`}
            >
              <span className="segment grid self-stretch rounded-l-[9px] text-center text-[1.45rem] leading-none font-black italic tabular-nums place-items-center">
                {rank}
              </span>
              <FighterFace fighter={f} />
              <span className="min-w-0 py-2">
                <strong className="block truncate text-[1.1rem] leading-[1.25] font-black md:text-[1.2rem]">{f.name}</strong>
                <span className="block text-xs font-semibold text-muted tabular-nums">
                  <span className="md:hidden">
                    {winRate}% wins{showCategory && ', '}
                  </span>
                  {showCategory && categoryLabels[f.category]}
                </span>
              </span>
              <span className="hidden text-sm font-bold tabular-nums md:block">
                {formatNumber(f.wins)}–{formatNumber(f.losses)}
              </span>
              <span className="hidden items-center gap-2.5 md:flex">
                <span className="h-3 flex-1 overflow-hidden rounded-full border-2 border-black bg-panel">
                  <span className="stripes block h-full bg-rank" style={{ width: `${winRate}%` }} />
                </span>
                <span className="w-9 text-right text-sm font-black tabular-nums">{winRate}%</span>
              </span>
              <span className="text-right">
                <b className="block text-[1.2rem] leading-none font-black tabular-nums">{formatNumber(f.elo)}</b>
                <Movement change={f.rankChange} className="mt-1 block md:hidden" />
              </span>
              <Movement change={f.rankChange} className="hidden text-right md:block" />
            </li>
          )
        })}
      </ol>
      {hasMore && <div ref={sentinel} aria-hidden="true" />}
    </div>
  )
}

function Movement({ change, className = '' }: { change: number; className?: string }) {
  const places = (n: number) => `${n} place${n === 1 ? '' : 's'}`
  const base = `text-[.6875rem] font-black md:text-sm ${className}`
  if (change > 0)
    return (
      <span className={`${base} text-up`} aria-label={`Up ${places(change)}`}>
        ▲ {change}
      </span>
    )
  if (change < 0)
    return (
      <span className={`${base} text-corner-l`} aria-label={`Down ${places(-change)}`}>
        ▼ {-change}
      </span>
    )
  return <span className={`${base} text-muted`}>No change</span>
}
