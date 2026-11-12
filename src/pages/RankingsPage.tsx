import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { useSearchParams } from 'react-router'
import { categories, categoryLabels, rankingsQuery } from '../api/queries'
import type { Category, ClosestCall, RankedFighter } from '../api/types'
import { FighterGlyph, ProgressBar } from '../components/win'
import { formatNumber, percent } from '../lib/format'

const isCategory = (value: string | null): value is Category => categories.some((c) => c === value)

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .toLowerCase()

export function RankingsPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('category')
  const category = isCategory(raw) ? raw : undefined
  const [search, setSearch] = useState('')
  const query = normalize(useDeferredValue(search)).trim()

  const { data, error, refetch } = useQuery(rankingsQuery(category))

  const rows = (data?.fighters ?? []).map((fighter, i) => ({ fighter, rank: i + 1 }))
  const matches = query ? rows.filter((r) => normalize(r.fighter.name).includes(query)) : rows

  return (
    <div className="rankings">
      <div className="toolbar">
        <label htmlFor="search">Search:</label>
        <input
          id="search"
          type="search"
          className="textbox"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
          autoComplete="off"
        />
        <label htmlFor="category">Category:</label>
        <select
          id="category"
          className="combobox"
          value={category ?? ''}
          onChange={(e) => setParams(e.target.value ? { category: e.target.value } : {}, { replace: true })}
        >
          <option value="">(All)</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {categoryLabels[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="rankings-body">
        {error && !data ? (
          <fieldset className="groupbox">
            <legend>Error</legend>
            <p>Rankings didn’t load: {error.message}</p>
            <button type="button" className="btn" onClick={() => refetch()}>
              Retry
            </button>
          </fieldset>
        ) : (
          <DataGridView key={`${category}:${query}`} rows={matches} />
        )}

        <aside className="side">
          <fieldset className="groupbox">
            <legend>Top 3</legend>
            <ol className="top3">
              {rows.slice(0, 3).map(({ fighter, rank }) => (
                <li key={fighter.id}>
                  <span aria-hidden="true">{['🥇', '🥈', '🥉'][rank - 1]}</span> {fighter.name} ({formatNumber(fighter.elo)})
                </li>
              ))}
            </ol>
          </fieldset>
          {data && data.closestCalls.length > 0 && <ClosestCalls calls={data.closestCalls} />}
        </aside>
      </div>

      <p className="small">
        {query ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'} found. ` : ''}
        {data ? `${formatNumber(data.totalVotes)} ${data.totalVotes === 1 ? 'vote' : 'votes'} cast.` : ''}
      </p>
    </div>
  )
}

function ClosestCalls({ calls }: { calls: ClosestCall[] }) {
  return (
    <fieldset className="groupbox">
      <legend>Closest calls</legend>
      <ul className="closest">
        {calls.map((c) => {
          const leftPct = percent(c.leftVotes, c.leftVotes + c.rightVotes)
          return (
            <li key={`${c.left.id}~${c.right.id}`}>
              <span className="small">
                {c.left.name} vs {c.right.name}
              </span>
              <ProgressBar value={leftPct} label={`${c.left.name} ${leftPct}%, ${c.right.name} ${100 - leftPct}%`} />
              <span className="small">
                {leftPct}% / {100 - leftPct}%
              </span>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

/** A DataGridView with every default left on, including the dark gray area under the last row. */
function DataGridView({ rows }: { rows: { fighter: RankedFighter; rank: number }[] }) {
  const [selected, setSelected] = useState(rows[0]?.fighter.id)

  return (
    <div className="datagrid" tabIndex={-1}>
      <table>
        <thead>
          <tr>
            <th className="rowheader" aria-hidden="true" />
            <th>Rank</th>
            <th>Fighter</th>
            <th>Category</th>
            <th>W</th>
            <th>L</th>
            <th>Win %</th>
            <th>Rating</th>
            <th>This week</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ fighter: f, rank }) => (
            <tr key={f.id} aria-selected={selected === f.id} onClick={() => setSelected(f.id)}>
              <td className="rowheader" aria-hidden="true">
                {selected === f.id ? '▶' : ''}
              </td>
              <td className="num">{rank}</td>
              <td className="name">
                <FighterGlyph fighter={f} /> {f.name}
              </td>
              <td>{categoryLabels[f.category]}</td>
              <td className="num">{formatNumber(f.wins)}</td>
              <td className="num">{formatNumber(f.losses)}</td>
              <td className="num">{percent(f.wins, f.wins + f.losses)}</td>
              <td className="num">{formatNumber(f.elo)}</td>
              <td className="num">{f.rankChange > 0 ? `+${f.rankChange}` : f.rankChange}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
