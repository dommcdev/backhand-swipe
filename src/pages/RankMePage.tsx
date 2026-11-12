import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { rankingsQuery } from '../api/queries'
import type { RankedFighter } from '../api/types'
import { winChance } from '../lib/elo'
import { CM_PER_IN, formatNumber, LB_PER_KG, ordinal } from '../lib/format'
import { messageBox } from '../lib/messageBox'
import { hasBodyStats, predictRating, type BodyStats } from '../lib/rankMe'
import { setUnits, useUnits, type Units } from '../lib/units'

type FieldName = 'weight' | 'age' | 'height'

interface FormValues {
  weight: string
  age: string
  cm: string
  ft: string
  inches: string
}

const emptyValues: FormValues = { weight: '', age: '', cm: '', ft: '', inches: '' }
const fieldNames: FieldName[] = ['weight', 'age', 'height']

const num = (value: string) => (value.trim() === '' ? NaN : Number(value))

function toStats(units: Units, v: FormValues): BodyStats {
  if (units === 'metric') return { weightKg: num(v.weight), heightCm: num(v.cm), age: num(v.age) }
  const inches = v.inches.trim() === '' ? 0 : num(v.inches)
  return { weightKg: num(v.weight) / LB_PER_KG, heightCm: (num(v.ft) * 12 + inches) * CM_PER_IN, age: num(v.age) }
}

/** Rewrites what has been typed so far in the other units. */
function convertValues(from: Units, values: FormValues, to: Units): FormValues {
  const { weightKg, heightCm } = toStats(from, values)
  const next = { ...emptyValues, age: values.age }
  if (!Number.isNaN(weightKg)) next.weight = String(Math.round(to === 'metric' ? weightKg : weightKg * LB_PER_KG))
  if (!Number.isNaN(heightCm)) {
    const totalIn = Math.round(heightCm / CM_PER_IN)
    if (to === 'metric') next.cm = String(Math.round(heightCm))
    else Object.assign(next, { ft: String(Math.floor(totalIn / 12)), inches: String(totalIn % 12) })
  }
  return next
}

/** One message per field, or an empty string when the field is fine. */
function fieldErrors(units: Units, values: FormValues, { weightKg, heightCm, age }: BodyStats): Record<FieldName, string> {
  const metric = units === 'metric'
  const inches = num(values.inches)

  let height = ''
  if (metric ? values.cm.trim() === '' : values.ft.trim() === '') height = 'Please enter your height.'
  else if (!metric && values.inches.trim() !== '' && !(inches >= 0 && inches < 12)) height = 'Inches go from 0 to 11.'
  else if (!(heightCm >= 120 && heightCm <= 230))
    height = `Height must be between ${metric ? '120 and 230 cm' : '3 ft 11 in and 7 ft 7 in'}.`

  return {
    weight: Number.isNaN(weightKg)
      ? 'Please enter your weight.'
      : weightKg < 30 || weightKg > 300
        ? `Weight must be between ${metric ? '30 and 300 kg' : '66 and 660 lb'}.`
        : '',
    age: Number.isNaN(age) ? 'Please enter your age.' : age < 10 || age > 100 ? 'Age must be between 10 and 100.' : '',
    height,
  }
}

const fieldIds: Record<FieldName, string> = { weight: 'weight', age: 'age', height: 'cm' }

export function RankMePage() {
  const units = useUnits()
  const [form, setForm] = useState({ units, values: emptyValues })
  if (form.units !== units) setForm({ units, values: convertValues(form.units, form.values, units) })
  const { values } = form
  const [you, setYou] = useState<BodyStats | null>(null)

  const { data } = useQuery(rankingsQuery())
  const fighters = data?.fighters ?? []
  const people = fighters.filter(hasBodyStats)
  const result = you && people.length > 0 ? predictRating(people, you) : undefined

  const set = (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, values: { ...f.values, [field]: e.target.value } }))

  async function calculate(e: React.FormEvent) {
    e.preventDefault()
    const stats = toStats(units, values)
    const errors = fieldErrors(units, values, stats)
    const bad = fieldNames.find((f) => errors[f])
    if (bad) {
      await messageBox(errors[bad], { caption: 'Error', icon: 'error' })
      const id = bad === 'height' && units === 'imperial' ? 'ft' : fieldIds[bad]
      const input = document.getElementById(id) as HTMLInputElement | null
      input?.focus()
      input?.select()
      return
    }
    setYou({ weightKg: Math.round(stats.weightKg), heightCm: Math.round(stats.heightCm), age: Math.round(stats.age) })
  }

  return (
    <div className="rankme">
      <div className="rankme-left">
        <form noValidate onSubmit={calculate} className="groupbox-form">
          <fieldset className="groupbox">
            <legend>Enter your stats</legend>
            <div className="form-grid">
              <label htmlFor="weight">Weight ({units === 'metric' ? 'kg' : 'lb'}):</label>
              <input id="weight" className="textbox" inputMode="decimal" value={values.weight} onChange={set('weight')} />
              <label htmlFor="age">Age:</label>
              <input id="age" className="textbox" inputMode="numeric" value={values.age} onChange={set('age')} />
              {units === 'metric' ? (
                <>
                  <label htmlFor="cm">Height (cm):</label>
                  <input id="cm" className="textbox" inputMode="decimal" value={values.cm} onChange={set('cm')} />
                </>
              ) : (
                <>
                  <label htmlFor="ft">Height (ft, in):</label>
                  <span className="pair">
                    <input id="ft" className="textbox" inputMode="numeric" value={values.ft} onChange={set('ft')} />
                    <input
                      id="in"
                      className="textbox"
                      inputMode="numeric"
                      aria-label="Inches"
                      value={values.inches}
                      onChange={set('inches')}
                    />
                  </span>
                </>
              )}
            </div>
          </fieldset>

          <fieldset className="groupbox">
            <legend>Units</legend>
            <label className="radio">
              <input type="radio" name="units" checked={units === 'metric'} onChange={() => setUnits('metric')} /> Metric
            </label>
            <label className="radio">
              <input type="radio" name="units" checked={units === 'imperial'} onChange={() => setUnits('imperial')} /> Imperial
            </label>
          </fieldset>

          <button type="submit" className="btn default">
            Calculate
          </button>
        </form>

        <fieldset className="groupbox" aria-live="polite">
          <legend>Results</legend>
          <Results fighters={fighters} elo={result?.elo} lookalike={result?.lookalike.name} />
        </fieldset>
      </div>

      <Ladder fighters={fighters} youElo={result?.elo} />
    </div>
  )
}

function Results({ fighters, elo, lookalike }: { fighters: RankedFighter[]; elo?: number; lookalike?: string }) {
  if (elo === undefined || fighters.length === 0) return <p>Fill in all three and click Calculate.</p>

  const place = fighters.filter((f) => f.elo >= elo).length + 1
  const champ = fighters[0]
  const avgChance = Math.round((fighters.reduce((s, f) => s + winChance(elo, f.elo), 0) / fighters.length) * 100)

  return (
    <dl className="results">
      <dt>Your rating:</dt>
      <dd>{formatNumber(elo)}</dd>
      <dt>Place:</dt>
      <dd>
        {ordinal(place)} of {fighters.length + 1}
      </dd>
      <dt>Fights you’d win:</dt>
      <dd>{avgChance}%</dd>
      <dt>Built most like:</dt>
      <dd>{lookalike}</dd>
      <dt>Vs. {champ.name}:</dt>
      <dd>{Math.round(winChance(elo, champ.elo) * 100)}% chance</dd>
    </dl>
  )
}

/** A ListBox of the whole ladder with you selected in it. */
function Ladder({ fighters, youElo }: { fighters: RankedFighter[]; youElo?: number }) {
  const list = useRef<HTMLOListElement>(null)
  const rows = fighters.map((f) => ({ id: f.id, name: f.name, elo: f.elo }))
  if (youElo !== undefined) {
    const at = rows.findIndex((r) => r.elo < youElo)
    rows.splice(at === -1 ? rows.length : at, 0, { id: 'you', name: '>>> YOU <<<', elo: youElo })
  }

  useEffect(() => {
    const box = list.current
    const you = box?.querySelector<HTMLElement>('[aria-selected=true]')
    if (box && you) box.scrollTop = you.offsetTop - box.clientHeight / 2
  }, [youElo])

  return (
    <div className="ladder">
      <span id="ladder-label">Ladder:</span>
      <ol ref={list} className="listbox" aria-labelledby="ladder-label">
        {rows.map((r, i) => (
          <li key={r.id} aria-selected={r.id === 'you'}>
            {i + 1}. {r.name} - {formatNumber(r.elo)}
          </li>
        ))}
      </ol>
    </div>
  )
}
