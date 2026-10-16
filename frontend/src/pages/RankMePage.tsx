import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { categoryLabels, rankingsQuery } from '../api/queries'
import type { RankedFighter } from '../api/types'
import { FighterFace } from '../components/FighterArt'
import { winChance } from '../lib/elo'
import { formatNumber, formatWeight, ordinal } from '../lib/format'
import { hasBodyStats, predictRating, type BodyStats, type RatedPerson } from '../lib/rankMe'

type Units = 'metric' | 'imperial'
type FieldName = 'weight' | 'age' | 'height'

interface FormValues {
  weight: string
  age: string
  cm: string
  ft: string
  inches: string
}

const LB_PER_KG = 2.20462
const CM_PER_IN = 2.54
const fieldNames: FieldName[] = ['weight', 'age', 'height']

const num = (value: string) => (value.trim() === '' ? NaN : Number(value))

function toStats(units: Units, v: FormValues): BodyStats {
  if (units === 'metric') return { weightKg: num(v.weight), heightCm: num(v.cm), age: num(v.age) }
  const inches = v.inches.trim() === '' ? 0 : num(v.inches)
  return { weightKg: num(v.weight) / LB_PER_KG, heightCm: (num(v.ft) * 12 + inches) * CM_PER_IN, age: num(v.age) }
}

/** One message per field, or an empty string when the field is fine. */
function fieldErrors(units: Units, values: FormValues, { weightKg, heightCm, age }: BodyStats): Record<FieldName, string> {
  const metric = units === 'metric'
  const inches = num(values.inches)

  let height = ''
  if (metric ? values.cm.trim() === '' : values.ft.trim() === '') height = 'Enter your height.'
  else if (!metric && values.inches.trim() !== '' && !(inches >= 0 && inches < 12)) height = 'Inches go from 0 to 11.'
  else if (!(heightCm >= 120 && heightCm <= 230))
    height = `Enter a height between ${metric ? '120 and 230 cm' : '3 ft 11 in and 7 ft 7 in'}.`

  return {
    weight: Number.isNaN(weightKg)
      ? 'Enter your weight.'
      : weightKg < 30 || weightKg > 300
        ? `Enter a weight between ${metric ? '30 and 300 kg' : '66 and 660 lb'}.`
        : '',
    age: Number.isNaN(age) ? 'Enter your age.' : age < 10 || age > 100 ? 'Enter an age between 10 and 100.' : '',
    height,
  }
}

function describeBody(units: Units, weightKg: number, heightCm: number, age: number) {
  if (units === 'metric') return `${Math.round(heightCm)} cm, ${Math.round(weightKg)} kg, ${age} yrs`
  const totalIn = Math.round(heightCm / CM_PER_IN)
  return `${Math.floor(totalIn / 12)}′${totalIn % 12}″, ${Math.round(weightKg * LB_PER_KG)} lb, ${age} yrs`
}

function describeWeight(units: Units, kg: number) {
  if (units === 'metric') return formatWeight(kg)
  const lb = kg * LB_PER_KG
  if (lb >= 1) return `${formatNumber(Math.round(lb))} lb`
  return lb * 16 >= 1 ? `${Math.round(lb * 16)} oz` : 'under 1 oz'
}

const describeFighter = (units: Units, f: RankedFighter) =>
  hasBodyStats(f)
    ? describeBody(units, f.weightKg, f.heightCm, f.age)
    : `${categoryLabels[f.category]}, ${describeWeight(units, f.weightKg * f.count)}`

export function RankMePage() {
  const [units, setUnits] = useState<Units>('metric')
  const [values, setValues] = useState<FormValues>({ weight: '', age: '', cm: '', ft: '', inches: '' })
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({ weight: false, age: false, height: false })

  const stats = toStats(units, values)
  const errors = fieldErrors(units, values, stats)
  const valid = fieldNames.every((f) => !errors[f])
  const shown = (f: FieldName) => (touched[f] ? errors[f] : '')
  const rounded = { weightKg: Math.round(stats.weightKg), heightCm: Math.round(stats.heightCm), age: Math.round(stats.age) }

  const { data } = useQuery(rankingsQuery())
  const fighters = data?.fighters ?? []
  const people = fighters.filter(hasBodyStats)
  const you = valid && people.length > 0 ? predictRating(people, rounded) : undefined

  function switchUnits(next: Units) {
    if (next === units) return
    const kg = stats.weightKg
    const cm = stats.heightCm
    const patch: Partial<FormValues> = {}
    if (!Number.isNaN(kg)) patch.weight = String(Math.round(next === 'metric' ? kg : kg * LB_PER_KG))
    if (!Number.isNaN(cm)) {
      const totalIn = Math.round(cm / CM_PER_IN)
      Object.assign(patch, next === 'metric' ? { cm: String(Math.round(cm)) } : { ft: String(Math.floor(totalIn / 12)), inches: String(totalIn % 12) })
    }
    setValues((v) => ({ ...v, ...patch }))
    setUnits(next)
  }

  const set = (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }))
  const touch = (field: FieldName) => () => setTouched((t) => (t[field] ? t : { ...t, [field]: true }))

  const other: Units = units === 'metric' ? 'imperial' : 'metric'

  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start md:gap-x-14 md:pt-2">
      <div className="flex flex-col gap-5 md:sticky md:top-6">
        <form noValidate onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-1">
          <div className="pb-6">
            <div role="group" aria-label="Units" className="group flex h-[56px] items-stretch rounded-xl border-[3px] border-black bg-card shadow-lift-sm">
              <span className="cut flex w-[112px] shrink-0 items-center rounded-l-[9px] bg-black pl-3.5 text-[1.05rem] font-black text-white italic transition-colors group-focus-within:stripes group-focus-within:bg-me">
                Units
              </span>
              <div className="flex flex-1 items-center justify-between px-2">
                <UnitArrow direction="left" label={`Switch to ${other}`} onClick={() => switchUnits(other)} />
                <span className="text-[1.2rem] font-black capitalize italic">{units}</span>
                <UnitArrow direction="right" label={`Switch to ${other}`} onClick={() => switchUnits(other)} />
              </div>
            </div>
          </div>

          <Field label="Weight" id="weight" error={shown('weight')} onLeave={touch('weight')}>
            <NumberBox
              id="weight"
              unit={units === 'metric' ? 'kg' : 'lb'}
              placeholder={units === 'metric' ? '80' : '175'}
              value={values.weight}
              error={shown('weight')}
              errorId="weight-error"
              onChange={set('weight')}
            />
          </Field>
          <Field label="Age" id="age" error={shown('age')} onLeave={touch('age')}>
            <NumberBox id="age" unit="years" placeholder="30" value={values.age} error={shown('age')} errorId="age-error" onChange={set('age')} />
          </Field>
          {units === 'metric' ? (
            <Field label="Height" id="cm" error={shown('height')} onLeave={touch('height')}>
              <NumberBox id="cm" unit="cm" placeholder="178" value={values.cm} error={shown('height')} errorId="cm-error" onChange={set('cm')} />
            </Field>
          ) : (
            <Field label="Height" id="ft" error={shown('height')} onLeave={touch('height')}>
              <NumberBox id="ft" unit="ft" placeholder="5" value={values.ft} error={shown('height')} errorId="ft-error" onChange={set('ft')} />
              <NumberBox
                id="in"
                unit="in"
                placeholder="10"
                label="Inches"
                value={values.inches}
                error={shown('height')}
                errorId="ft-error"
                onChange={set('inches')}
              />
            </Field>
          )}
        </form>

        <Verdict fighters={fighters} elo={you?.elo} lookalike={you?.lookalike} />
      </div>

      <Ladder fighters={fighters} youElo={you?.elo} you={rounded} units={units} />
    </div>
  )
}

function UnitArrow({ direction, label, onClick }: { direction: 'left' | 'right'; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-10 place-items-center rounded-lg text-me hover:bg-panel focus-visible:bg-panel focus-visible:outline-none"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-6">
        <path d={direction === 'left' ? 'M14 3 5 10l9 7z' : 'm6 3 9 7-9 7z'} fill="currentColor" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function Verdict({ fighters, elo, lookalike }: { fighters: RankedFighter[]; elo?: number; lookalike?: RatedPerson }) {
  if (elo === undefined || fighters.length === 0) {
    return (
      <section aria-live="polite" className="flex flex-col gap-2">
        <h2 className="m-0 text-[2.1rem] leading-[1.08] font-black text-balance italic md:text-[2.5rem]">
          Fill in all three to join the ladder
        </h2>
      </section>
    )
  }

  const above = fighters.filter((f) => f.elo >= elo)
  const place = above.length + 1
  const prev = above.at(-1)
  const next = fighters[above.length]
  const champ = fighters[0]
  const avgChance = Math.round((fighters.reduce((s, f) => s + winChance(elo, f.elo), 0) / fighters.length) * 100)

  const rating = `That’s a ${formatNumber(elo)} rating`
  const placement = !prev
    ? `${rating} and first place, ahead of ${next.name}.`
    : !next
      ? `${rating} and last place, just behind ${prev.name}.`
      : `${rating}, ${ordinal(place)} of ${fighters.length + 1}, between ${prev.name} and ${next.name}.`

  return (
    <section aria-live="polite" className="flex flex-col gap-2">
      <h2 className="m-0 text-[2.1rem] leading-[1.08] font-black text-balance italic md:text-[2.5rem]">
        You’d win {avgChance}% of these fights
      </h2>
      <p className="m-0 leading-snug font-semibold">{placement}</p>
      <p className="m-0 leading-snug font-medium text-muted">
        {lookalike && `Built most like ${lookalike.name}. `}
        {champ.id !== lookalike?.id && `Against ${champ.name} you’d have a ${Math.round(winChance(elo, champ.elo) * 100)}% chance.`}
      </p>
    </section>
  )
}

interface LadderProps {
  fighters: RankedFighter[]
  youElo?: number
  you: BodyStats
  units: Units
}

type LadderRow = { id: string; name: string; elo: number; stats: string; fighter?: RankedFighter }
type LadderItem = { kind: 'row'; row: LadderRow; rank: number } | { kind: 'gap'; id: string; hidden: number }

/** Shows the champion and the fighters around you. The gaps expand to the whole ladder. */
function Ladder({ fighters, youElo, you, units }: LadderProps) {
  const [showAll, setShowAll] = useState(false)

  const rows: LadderRow[] = fighters.map((f) => ({ id: f.id, name: f.name, elo: f.elo, stats: describeFighter(units, f), fighter: f }))
  if (youElo !== undefined) {
    const at = rows.findIndex((r) => r.elo < youElo)
    rows.splice(at === -1 ? rows.length : at, 0, {
      id: 'you',
      name: 'You',
      elo: youElo,
      stats: describeBody(units, you.weightKg, you.heightCm, you.age),
    })
  }

  const youAt = rows.findIndex((r) => r.id === 'you')
  const [start, end] = showAll ? [0, rows.length - 1] : youAt === -1 ? [0, 9] : [Math.max(0, youAt - 4), Math.min(rows.length - 1, youAt + 4)]
  const items: LadderItem[] = []
  if (start > 0) items.push({ kind: 'row', row: rows[0], rank: 1 })
  if (start > 1) items.push({ kind: 'gap', id: 'gap-above', hidden: start - 1 })
  for (let i = start; i <= end; i++) items.push({ kind: 'row', row: rows[i], rank: i + 1 })
  if (end < rows.length - 1) items.push({ kind: 'gap', id: 'gap-below', hidden: rows.length - 1 - end })

  return (
    <ol aria-label="Every fighter ranked by rating" className="m-0 flex list-none flex-col gap-1.5 p-0">
      {items.map((item) =>
        item.kind === 'gap' ? (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="press stripes flex h-11 w-full items-center justify-center rounded-xl border-[3px] border-black bg-slate text-[.9375rem] font-black text-white italic shadow-lift-sm"
            >
              Show {item.hidden} more
            </button>
          </li>
        ) : (
          <LadderEntry key={item.row.id} row={item.row} rank={item.rank} />
        ),
      )}
    </ol>
  )
}

function LadderEntry({ row, rank }: { row: LadderRow; rank: number }) {
  const isYou = !row.fighter
  return (
    <li
      className={`grid min-h-[60px] grid-cols-[52px_44px_1fr_auto] items-center gap-x-3 rounded-xl border-[3px] border-black pr-3.5 shadow-lift-sm ${
        isYou ? 'stripes my-1.5 min-h-[68px] origin-center bg-me motion-safe:animate-[slot_.45s_cubic-bezier(.2,.8,.2,1)]' : 'bg-card'
      }`}
    >
      <span className="segment grid place-items-center self-stretch rounded-l-[9px] text-[1.3rem] font-black italic tabular-nums">{rank}</span>
      {row.fighter ? (
        <FighterFace fighter={row.fighter} />
      ) : (
        <span className="grid size-11 place-items-center rounded-xl border-2 border-black bg-white text-[.9rem] font-black text-black">You</span>
      )}
      <span className="min-w-0 py-1.5">
        <strong className={`block truncate leading-[1.25] font-black ${isYou ? 'outlined text-[1.4rem] italic' : 'text-[1.05rem]'}`}>
          {row.name}
        </strong>
        <span className={`mt-0.5 block text-xs font-semibold tabular-nums ${isYou ? 'text-white' : 'text-muted'}`}>{row.stats}</span>
      </span>
      <span className={`font-black tabular-nums ${isYou ? 'outlined text-[1.4rem] italic' : 'text-[1.2rem]'}`}>{formatNumber(row.elo)}</span>
    </li>
  )
}

interface FieldProps {
  label: string
  id: string
  error: string
  /** Fires when focus leaves the whole field, so a two-part height counts as one field. */
  onLeave: () => void
  children: React.ReactNode
}

function Field({ label, id, error, onLeave, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <div
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && onLeave()}
        className="group flex h-[56px] items-stretch rounded-xl border-[3px] border-black bg-card shadow-lift-sm"
      >
        <label
          htmlFor={id}
          className={`cut flex w-[112px] shrink-0 items-center rounded-l-[9px] pl-3.5 text-[1.05rem] font-black text-white italic transition-colors group-focus-within:stripes group-focus-within:bg-me ${
            error ? 'stripes bg-corner-l' : 'bg-black'
          }`}
        >
          {label}
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-1 pr-1">{children}</div>
      </div>
      <p id={`${id}-error`} aria-live="polite" className="m-0 min-h-5 px-1 text-[.8125rem] leading-5 font-bold text-corner-l">
        {error}
      </p>
    </div>
  )
}

interface NumberBoxProps {
  id: string
  unit: string
  placeholder: string
  value: string
  label?: string
  error: string
  errorId: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function NumberBox({ id, unit, placeholder, value, label, error, errorId, onChange }: NumberBoxProps) {
  return (
    <div className="flex h-full min-w-0 flex-1 items-center pr-2.5">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        value={value}
        onChange={onChange}
        className="h-full w-full min-w-0 flex-1 border-0 bg-transparent pr-1 pl-2 text-right text-[1.6rem] font-black text-fg outline-none placeholder:text-muted/45"
      />
      <span className="w-[2.6em] shrink-0 text-[.875rem] font-bold text-muted">{unit}</span>
    </div>
  )
}
