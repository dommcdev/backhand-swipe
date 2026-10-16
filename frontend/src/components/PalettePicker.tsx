import { palettes, setPalette, usePalette } from '../lib/palette'

export function PalettePicker() {
  const current = usePalette()

  return (
    <div className="flex flex-wrap items-center justify-center gap-3" role="group" aria-label="Palette">
      <span className="text-sm font-bold">Palette</span>
      {palettes.map((p) => (
        <button
          key={p.id}
          type="button"
          title={p.name}
          aria-label={p.name}
          aria-pressed={current === p.id}
          onClick={() => setPalette(p.id)}
          className="press h-9 w-14 -skew-x-10 rounded-lg shadow-lift-sm outline-offset-3 aria-pressed:outline-3 aria-pressed:outline-fg"
        >
          <span className="flex size-full overflow-hidden rounded-lg">
            {p.swatch.map((color) => (
              <span key={color} className="flex-1" style={{ background: color }} />
            ))}
          </span>
        </button>
      ))}
    </div>
  )
}
