import { palettes, setPalette, usePalette } from '../lib/palette'
import { setUnits, useUnits, type Units } from '../lib/units'

const unitOptions: { id: Units; label: string }[] = [
  { id: 'metric', label: 'Metric' },
  { id: 'imperial', label: 'Imperial' },
]

export function SettingsMenu() {
  const palette = usePalette()
  const units = useUnits()

  return (
    <>
      <button
        type="button"
        popoverTarget="settings"
        aria-label="Settings"
        className="press stripes grid size-12 shrink-0 place-items-center rounded-xl border-[3px] border-black bg-slate shadow-lift-sm md:h-[50px] md:w-[58px] md:-skew-x-10"
      >
        <span className="size-7 drop-shadow-[0_2px_0_#000] md:skew-x-10">
          <GearIcon />
        </span>
      </button>

      <div
        id="settings"
        popover="auto"
        aria-label="Settings"
        className="settings-panel inset-auto top-[76px] right-[18px] left-[18px] m-0 w-auto flex-col gap-4 rounded-[22px] border-[3px] border-black bg-card p-4 text-fg shadow-lift open:flex md:top-[96px] md:right-[max(40px,calc(50vw-550px))] md:left-auto md:w-[380px]"
      >
        <section role="group" aria-labelledby="settings-palette" className="flex flex-col gap-3">
          <h2 id="settings-palette" className="m-0 flex items-baseline justify-between text-[1.05rem] font-black italic">
            Palette
            <span className="text-sm font-bold text-muted not-italic">{palettes.find((p) => p.id === palette)?.name}</span>
          </h2>
          <div className="grid grid-cols-4 gap-x-3 gap-y-5 pb-3">
            {palettes.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.name}
                aria-label={p.name}
                aria-pressed={palette === p.id}
                onClick={() => setPalette(p.id)}
                className="press relative h-10 -skew-x-10 rounded-lg border-[3px] border-black bg-black shadow-lift-sm after:absolute after:-bottom-3.5 after:left-1/2 after:h-1.5 after:w-7 after:-translate-x-1/2 after:rounded-full after:bg-fg after:opacity-0 aria-pressed:after:opacity-100"
              >
                <span className="flex size-full overflow-hidden rounded-[5px]">
                  {p.swatch.map((color) => (
                    <span key={color} className="flex-1" style={{ background: color }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section role="group" aria-labelledby="settings-units" className="flex flex-col gap-3">
          <h2 id="settings-units" className="m-0 text-[1.05rem] font-black italic">
            Units
          </h2>
          <div className="flex gap-2">
            {unitOptions.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={units === o.id}
                onClick={() => setUnits(o.id)}
                className="press stripes h-11 flex-1 rounded-xl border-[3px] border-black bg-slate text-[.95rem] font-black text-white italic shadow-lift-sm aria-pressed:bg-rank"
              >
                <span className={units === o.id ? 'outlined' : ''}>{o.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

const gearShapes = (
  <>
    {[0, 45, 90, 135].map((angle) => (
      <rect key={angle} x="9.75" y="1.5" width="4.5" height="21" rx="1.2" transform={`rotate(${angle} 12 12)`} />
    ))}
    <circle cx="12" cy="12" r="7.25" />
  </>
)

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full">
      <g stroke="#000" strokeWidth="4" strokeLinejoin="round">
        {gearShapes}
      </g>
      <g fill="#fff">{gearShapes}</g>
      <circle cx="12" cy="12" r="3" fill="#000" />
    </svg>
  )
}
