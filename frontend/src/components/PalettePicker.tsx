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
          className="press relative h-9 w-14 -skew-x-10 rounded-lg border-[3px] border-black bg-black shadow-lift-sm after:absolute after:-bottom-3.5 after:left-1/2 after:h-1.5 after:w-7 after:-translate-x-1/2 after:rounded-full after:bg-fg after:opacity-0 aria-pressed:after:opacity-100"
        >
          <span className="flex size-full overflow-hidden rounded-[5px]">
            {p.swatch.map((color) => (
              <span key={color} className="flex-1" style={{ background: color }} />
            ))}
          </span>
        </button>
      ))}
    </div>
  )
}
