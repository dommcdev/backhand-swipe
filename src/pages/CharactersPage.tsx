import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { categories, categoryLabels, fightersQuery } from '../api/queries'
import type { Category, Fighter, FighterInput } from '../api/types'
import { FighterFace } from '../components/FighterArt'
import { formatWeight } from '../lib/format'
import { useUnits } from '../lib/units'

interface FormValues {
  name: string
  shortName: string
  category: Category
  count: string
  emoji: string
  weightKg: string
  heightCm: string
  age: string
}

const emptyForm: FormValues = {
  name: '',
  shortName: '',
  category: 'fictional',
  count: '1',
  emoji: '',
  weightKg: '',
  heightCm: '',
  age: '',
}

const toForm = (f: Fighter): FormValues => ({
  name: f.name,
  shortName: f.shortName,
  category: f.category,
  count: String(f.count),
  emoji: f.emoji ?? '',
  weightKg: String(f.weightKg),
  heightCm: f.heightCm === undefined ? '' : String(f.heightCm),
  age: f.age === undefined ? '' : String(f.age),
})

const optional = (value: string) => (value.trim() === '' ? undefined : Number(value))

const toInput = (v: FormValues): FighterInput => ({
  name: v.name,
  shortName: v.shortName.trim() || undefined,
  category: v.category,
  count: Number(v.count),
  emoji: v.emoji.trim() || undefined,
  weightKg: Number(v.weightKg),
  heightCm: optional(v.heightCm),
  age: optional(v.age),
})

/** Add, edit, and delete fighters. Anyone can change anything. */
export function CharactersPage() {
  const queryClient = useQueryClient()
  const units = useUnits()
  const { data: fighters = [], error } = useQuery(fightersQuery)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<Fighter | null>(null)
  const [message, setMessage] = useState('')

  const refresh = () => {
    for (const key of ['fighters', 'rankings', 'roster']) queryClient.invalidateQueries({ queryKey: [key] })
  }

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      if (editing) await api.updateFighter(editing.id, toInput(v))
      else await api.addFighter(toInput(v))
    },
    onSuccess: () => {
      setMessage(editing ? `Saved ${form.name}.` : `Added ${form.name}.`)
      setForm(emptyForm)
      setEditing(null)
      refresh()
    },
  })

  const remove = useMutation({
    mutationFn: (f: Fighter) => api.deleteFighter(f.id),
    onSuccess: (_, f) => {
      setMessage(`Deleted ${f.name}.`)
      if (editing?.id === f.id) {
        setEditing(null)
        setForm(emptyForm)
      }
      refresh()
    },
  })

  const startEdit = (f: Fighter) => {
    setEditing(f)
    setForm(toForm(f))
    setMessage('')
    save.reset()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditing(null)
    setForm(emptyForm)
    save.reset()
  }

  const set = (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const sorted = [...fighters].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start md:gap-x-14 md:pt-2">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setMessage('')
          save.mutate(form)
        }}
        className="flex flex-col gap-3 md:sticky md:top-6"
      >
        <h2 className="m-0 text-[2.1rem] leading-[1.08] font-black italic md:text-[2.5rem]">
          {editing ? `Edit ${editing.name}` : 'Add a character'}
        </h2>
        <TextField label="Name" value={form.name} onChange={set('name')} placeholder="5 gorillas" required />
        <TextField label="Short name" value={form.shortName} onChange={set('shortName')} placeholder="the gorillas (optional)" />
        <Row label="Category">
          <select
            value={form.category}
            onChange={set('category')}
            className="h-full w-full min-w-0 bg-transparent px-2 text-[1.05rem] font-bold text-fg outline-none"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabels[c]}
              </option>
            ))}
          </select>
        </Row>
        <TextField label="How many" type="number" min="1" step="1" value={form.count} onChange={set('count')} required />
        <TextField label="Emoji" value={form.emoji} onChange={set('emoji')} placeholder="🦍 (optional)" />
        <TextField label="Weight kg" type="number" min="0" step="any" value={form.weightKg} onChange={set('weightKg')} placeholder="160" required />
        <TextField label="Height cm" type="number" min="1" step="1" value={form.heightCm} onChange={set('heightCm')} placeholder="optional" />
        <TextField label="Age" type="number" min="0" step="1" value={form.age} onChange={set('age')} placeholder="optional" />

        <div className="flex gap-2.5 pt-1">
          <button
            type="submit"
            disabled={save.isPending}
            className="press stripes h-12 flex-1 rounded-xl border-[3px] border-black bg-me shadow-lift-sm disabled:opacity-60"
          >
            <span className="outlined text-[1.1rem] font-black italic">{editing ? 'Save changes' : 'Add character'}</span>
          </button>
          {editing && (
            <button
              type="button"
              onClick={cancelEdit}
              className="press stripes h-12 rounded-xl border-[3px] border-black bg-slate px-5 text-white shadow-lift-sm"
            >
              <span className="font-black italic">Cancel</span>
            </button>
          )}
        </div>
        <p aria-live="polite" className="m-0 min-h-5 px-1 text-[.9rem] font-bold">
          {save.error ? <span className="text-corner-l">{save.error.message}</span> : remove.error ? <span className="text-corner-l">{remove.error.message}</span> : message}
        </p>
      </form>

      <section aria-label="All characters" className="flex flex-col gap-1.5">
        {error && <p className="m-0 font-semibold">Characters didn’t load: {error.message}</p>}
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {sorted.map((f) => (
            <li
              key={f.id}
              className="grid min-h-[62px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl border-[3px] border-black bg-card px-2.5 shadow-lift-sm"
            >
              <FighterFace fighter={f} />
              <span className="min-w-0 py-2">
                <strong className="block truncate text-[1.05rem] leading-[1.25] font-black">{f.name}</strong>
                <span className="block text-xs font-semibold text-muted">
                  {categoryLabels[f.category]}, {formatWeight(f.weightKg, units)}
                </span>
              </span>
              <span className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => startEdit(f)}
                  className="press rounded-lg border-2 border-black bg-slate px-3 py-1.5 text-sm font-black text-white shadow-lift-sm"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => confirm(`Delete ${f.name} and all of its votes?`) && remove.mutate(f)}
                  className="press rounded-lg border-2 border-black bg-corner-l px-3 py-1.5 text-sm font-black text-white shadow-lift-sm disabled:opacity-60"
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="group flex h-[52px] items-stretch rounded-xl border-[3px] border-black bg-card shadow-lift-sm">
      <span className="cut flex w-[132px] shrink-0 items-center rounded-l-[9px] bg-black pl-3.5 text-[.95rem] whitespace-nowrap font-black text-white italic transition-colors group-focus-within:stripes group-focus-within:bg-me">
        {label}
      </span>
      <span className="flex min-w-0 flex-1 items-center">{children}</span>
    </label>
  )
}

function TextField({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Row label={label}>
      <input
        {...input}
        className="h-full w-full min-w-0 bg-transparent px-3 text-[1.05rem] font-bold text-fg outline-none placeholder:text-muted/60"
      />
    </Row>
  )
}
