import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { rankingsQuery } from '../api/queries'
import { Monogram } from '../components/FighterArt'
import { winChance } from '../lib/elo'
import { formatNumber, ordinal } from '../lib/format'
import { hasBodyStats, predictRating, type BodyStats, type RatedPerson } from '../lib/rankMe'

type Units = 'metric' | 'imperial'

interface FormValues {
  weight: string
  age: string
  cm: string
  ft: string
  inches: string
}

const LB_PER_KG = 2.20462
const CM_PER_IN = 2.54

const num = (value: string) => (value.trim() === '' ? NaN : Number(value))

function toStats(units: Units, v: FormValues): BodyStats {
  if (units === 'metric') return { weightKg: num(v.weight), heightCm: num(v.cm), age: num(v.age) }
  const inches = v.inches.trim() === '' ? 0 : num(v.inches)
  return { weightKg: num(v.weight) / LB_PER_KG, heightCm: (num(v.ft) * 12 + inches) * CM_PER_IN, age: num(v.age) }
}

function validate(units: Units, { weightKg, heightCm, age }: BodyStats) {
  if ([weightKg, heightCm, age].some(Number.isNaN)) return { ok: false, message: '' }
  const metric = units === 'metric'
  if (weightKg < 30 || weightKg > 300)
    return { ok: false, message: `Enter a weight between ${metric ? '30 and 300 kg' : '66 and 660 lb'}.` }
  if (heightCm < 120 || heightCm > 230)
    return { ok: false, message: `Enter a height between ${metric ? '120 and 230 cm' : '3 ft 11 in and 7 ft 7 in'}.` }
  if (age < 10 || age > 100) return { ok: false, message: 'Enter an age between 10 and 100.' }
  return { ok: true, message: '' }
}

function describe(units: Units, weightKg: number, heightCm: number, age: number) {
  if (units === 'metric') return `${Math.round(heightCm)} cm, ${Math.round(weightKg)} kg, ${age} yrs`
  const totalIn = Math.round(heightCm / CM_PER_IN)
  return `${Math.floor(totalIn / 12)}′${totalIn % 12}″, ${Math.round(weightKg * LB_PER_KG)} lb, ${age} yrs`
}

export function RankMePage() {
  const [units, setUnits] = useState<Units>('metric')
  const [values, setValues] = useState<FormValues>({ weight: '', age: '', cm: '', ft: '', inches: '' })

  const stats = toStats(units, values)
  const validation = validate(units, stats)
  const rounded = { weightKg: Math.round(stats.weightKg), heightCm: Math.round(stats.heightCm), age: Math.round(stats.age) }

  const { data } = useQuery(rankingsQuery('people'))
  const people = data?.fighters.filter(hasBodyStats) ?? []
  const you = validation.ok && people.length > 0 ? predictRating(people, rounded) : undefined

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

  const other: Units = units === 'metric' ? 'imperial' : 'metric'

  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start md:gap-x-14 md:pt-2">
      <div className="flex flex-col gap-6 md:sticky md:top-6">
        <form
          noValidate
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col gap-3"
        >
          <div role="group" aria-label="Units" className="group flex h-[54px] items-stretch rounded-xl bg-card shadow-lift-sm">
            <span className="segment flex w-[112px] shrink-0 items-center rounded-l-xl pl-3.5 text-[1.05rem] font-black italic transition-colors group-focus-within:bg-me">
              Units
            </span>
            <div className="flex flex-1 items-center justify-between px-2">
              <UnitArrow direction="left" label={`Switch to ${other}`} onClick={() => switchUnits(other)} />
              <span className="text-[1.2rem] font-black capitalize italic">{units}</span>
              <UnitArrow direction="right" label={`Switch to ${other}`} onClick={() => switchUnits(other)} />
            </div>
          </div>

          <Field label="Weight" id="weight">
            <NumberBox id="weight" unit={units === 'metric' ? 'kg' : 'lb'} placeholder={units === 'metric' ? '80' : '175'} value={values.weight} onChange={set('weight')} />
          </Field>
          <Field label="Age" id="age">
            <NumberBox id="age" unit="years" placeholder="30" value={values.age} onChange={set('age')} />
          </Field>
          {units === 'metric' ? (
            <Field label="Height" id="cm">
              <NumberBox id="cm" unit="cm" placeholder="178" value={values.cm} onChange={set('cm')} />
            </Field>
          ) : (
            <Field label="Height" id="ft">
              <NumberBox id="ft" unit="ft" placeholder="5" value={values.ft} onChange={set('ft')} />
              <NumberBox id="in" unit="in" placeholder="10" label="Inches" value={values.inches} onChange={set('inches')} />
            </Field>
          )}
          <p role="alert" className="m-0 min-h-[1.2em] px-1 text-[.875rem] font-bold text-corner-l">
            {validation.message}
          </p>
        </form>

        <Verdict people={people} elo={you?.elo} lookalike={you?.lookalike} />
      </div>

      <Ladder people={people} youElo={you?.elo} you={rounded} units={units} />
    </div>
  )
}

function UnitArrow({ direction, label, onClick }: { direction: 'left' | 'right'; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="press grid size-9 place-items-center rounded-lg bg-panel text-me">
      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
        <path d={direction === 'left' ? 'M14 3 5 10l9 7z' : 'm6 3 9 7-9 7z'} fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function Verdict({ people, elo, lookalike }: { people: RatedPerson[]; elo?: number; lookalike?: RatedPerson }) {
  if (elo === undefined || people.length === 0) {
    return (
      <section aria-live="polite" className="flex flex-col gap-2">
        <h2 className="m-0 text-[2.1rem] leading-[1.08] font-black text-balance italic md:text-[2.5rem]">Fill in all three to join the ladder</h2>
      </section>
    )
  }

  const above = people.filter((p) => p.elo >= elo)
  const place = above.length + 1
  const prev = above.at(-1)
  const next = people[above.length]
  const champ = people[0]
  const avgChance = Math.round((people.reduce((s, p) => s + winChance(elo, p.elo), 0) / people.length) * 100)

  const rating = `That’s a ${formatNumber(elo)} rating`
  const placement = !prev
    ? `${rating} and first place, ahead of ${next.name}.`
    : !next
      ? `${rating} and last place, just behind ${prev.name}.`
      : `${rating}, ${ordinal(place)} of ${people.length + 1}, between ${prev.name} and ${next.name}.`

  return (
    <section aria-live="polite" className="flex flex-col gap-2">
      <h2 className="m-0 text-[2.1rem] leading-[1.08] font-black text-balance italic md:text-[2.5rem]">You’d win {avgChance}% of these fights</h2>
      <p className="m-0 leading-snug font-semibold">{placement}</p>
      {lookalike && (
        <p className="m-0 leading-snug font-medium text-muted">
          Built most like {lookalike.name}.
          {champ.id !== lookalike.id &&
            ` Against ${champ.name} you’d have a ${Math.round(winChance(elo, champ.elo) * 100)}% chance.`}
        </p>
      )}
    </section>
  )
}

interface LadderProps {
  people: RatedPerson[]
  youElo?: number
  you: BodyStats
  units: Units
}

function Ladder({ people, youElo, you, units }: LadderProps) {
  type Row = { id: string; name: string; elo: number; stats: string; isYou: boolean }
  const rows: Row[] = people.map((p) => ({
    id: p.id,
    name: p.name,
    elo: p.elo,
    stats: describe(units, p.weightKg, p.heightCm, p.age),
    isYou: false,
  }))
  if (youElo !== undefined) {
    const at = rows.findIndex((r) => r.elo < youElo)
    rows.splice(at === -1 ? rows.length : at, 0, {
      id: 'you',
      name: 'You',
      elo: youElo,
      stats: describe(units, you.weightKg, you.heightCm, you.age),
      isYou: true,
    })
  }
  const mid = Math.ceil(rows.length / 2)

  return (
    <ol aria-label="Famous people ranked by rating" className="m-0 flex list-none flex-col gap-1.5 p-0">
      {rows.map((r, i) => (
        <li
          key={r.id}
          className={`grid min-h-[58px] grid-cols-[52px_40px_1fr_auto] items-center gap-x-3 rounded-xl pr-3.5 ${
            r.isYou
              ? 'stripes my-1 min-h-[66px] origin-center bg-me shadow-lift motion-safe:animate-[slot_.45s_cubic-bezier(.2,.8,.2,1)]'
              : 'bg-card shadow-lift-sm'
          }`}
        >
          <span
            className="segment grid place-items-center self-stretch rounded-l-xl text-[1.3rem] font-black italic tabular-nums"
          >
            {i + 1}
          </span>
          {r.isYou ? (
            <span className="grid size-10 place-items-center rounded-full bg-white text-[.9rem] font-black text-black shadow-lift-sm">
              You
            </span>
          ) : (
            <Monogram name={r.name} className={`text-white ${i < mid ? 'bg-corner-l' : 'bg-corner-r'}`} />
          )}
          <span className="min-w-0 py-1.5">
            <strong className={`block leading-[1.2] font-black ${r.isYou ? 'outlined text-[1.4rem] italic' : 'text-[1.05rem]'}`}>
              {r.name}
            </strong>
            <span className={`mt-0.5 block text-xs font-semibold tabular-nums ${r.isYou ? 'text-white' : 'text-muted'}`}>
              {r.stats}
            </span>
          </span>
          <span className={`text-[1.2rem] font-black tabular-nums ${r.isYou ? 'outlined text-[1.4rem] italic' : ''}`}>
            {formatNumber(r.elo)}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="group flex h-[54px] items-stretch rounded-xl bg-card shadow-lift-sm">
      <label htmlFor={id} className="segment flex w-[112px] shrink-0 items-center rounded-l-xl pl-3.5 text-[1.05rem] font-black italic transition-colors group-focus-within:bg-me">
        {label}
      </label>
      <div className="flex min-w-0 flex-1 items-center gap-1 pr-1">{children}</div>
    </div>
  )
}

interface NumberBoxProps {
  id: string
  unit: string
  placeholder: string
  value: string
  label?: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function NumberBox({ id, unit, placeholder, value, label, onChange }: NumberBoxProps) {
  return (
    <div className="flex h-full min-w-0 flex-1 items-center pr-2.5">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        placeholder={placeholder}
        aria-label={label}
        value={value}
        onChange={onChange}
        className="h-full w-full min-w-0 flex-1 border-0 bg-transparent pr-1 pl-2 text-right text-[1.6rem] font-black text-fg outline-none placeholder:text-muted/45"
      />
      <span className="w-[2.6em] shrink-0 text-[.875rem] font-bold text-muted">{unit}</span>
    </div>
  )
}
