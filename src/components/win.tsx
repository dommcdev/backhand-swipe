import { useEffect, useRef, useState } from 'react'
import type { Fighter } from '../api/types'
import { formatNumber } from '../lib/format'
import { useMessageBox, type MessageBoxIcon } from '../lib/messageBox'

export type MenuItem =
  | { label: string; onClick?: () => void; checked?: boolean; disabled?: boolean; shortcut?: string }
  | 'separator'

export interface Menu {
  label: string
  items: MenuItem[]
}

/** A MenuStrip. Once a menu is open, hovering another one switches to it, like the real thing. */
export function MenuStrip({ menus }: { menus: Menu[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const strip = useRef<HTMLElement>(null)

  useEffect(() => {
    if (open === null) return
    const close = (e: Event) => !strip.current?.contains(e.target as Node) && setOpen(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    addEventListener('pointerdown', close)
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('pointerdown', close)
      removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <nav ref={strip} className="menustrip" aria-label="Menu">
      {menus.map((menu, i) => (
        <div key={menu.label} className="menu">
          <button
            type="button"
            className="menu-title"
            aria-haspopup="menu"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
            onPointerEnter={() => open !== null && setOpen(i)}
          >
            {menu.label}
          </button>
          {open === i && (
            <div role="menu" className="dropdown">
              {menu.items.map((item, j) =>
                item === 'separator' ? (
                  <hr key={j} />
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={item.checked ?? false}
                    disabled={item.disabled}
                    autoFocus={j === 0}
                    onClick={() => {
                      setOpen(null)
                      item.onClick?.()
                    }}
                  >
                    <span className="check">{item.checked ? '✓' : ''}</span>
                    <span className="grow">{item.label}</span>
                    <span className="shortcut">{item.shortcut}</span>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </nav>
  )
}

/** The one MessageBox that can be on screen at a time. Opened with messageBox(). */
export function MessageBoxHost() {
  const box = useMessageBox()
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = dialog.current
    if (!box || !d) return
    if (!d.open) d.showModal()
    // showModal() focuses the title bar's close button; a real MessageBox focuses the first button.
    d.querySelector<HTMLButtonElement>('.msgbox-buttons button')?.focus()
  }, [box])

  if (!box) return null
  const dismiss = box.buttons.includes('Cancel') ? 'Cancel' : box.buttons.includes('No') ? 'No' : box.buttons.at(-1)!

  return (
    <dialog
      ref={dialog}
      className="msgbox"
      aria-label={box.caption}
      onCancel={(e) => {
        e.preventDefault()
        box.resolve(dismiss)
      }}
    >
      <div className="titlebar">
        <span className="title">{box.caption}</span>
        <button type="button" className="caption-btn close" aria-label="Close" onClick={() => box.resolve(dismiss)}>
          <CloseGlyph />
        </button>
      </div>
      <div className="msgbox-body">
        <SystemIcon icon={box.icon} />
        <p>{box.text}</p>
      </div>
      <div className="msgbox-buttons">
        {box.buttons.map((b) => (
          <button key={b} type="button" className="btn" onClick={() => box.resolve(b)}>
            {b}
          </button>
        ))}
      </div>
    </dialog>
  )
}

function SystemIcon({ icon }: { icon: MessageBoxIcon }) {
  const glyph = { information: 'i', warning: '!', error: '✕', question: '?' }[icon]
  return (
    <span aria-hidden="true" className={`sysicon ${icon}`}>
      {glyph}
    </span>
  )
}

export function CloseGlyph() {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" width="10" height="10">
      <path d="M0 0 10 10M10 0 0 10" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

/** The default form icon, which nobody ever changes. */
export function FormIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" width="16" height="16">
      <rect x="1.5" y="2.5" width="13" height="11" fill="#fff" stroke="#3c3c3c" />
      <rect x="2" y="3" width="12" height="2.5" fill="#2b79d0" />
      <rect x="3" y="7" width="4" height="1" fill="#9a9a9a" />
      <rect x="3" y="9" width="6" height="1" fill="#9a9a9a" />
    </svg>
  )
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="progress">
      <div style={{ width: `${value}%` }} />
    </div>
  )
}

const initials = (name: string) =>
  name
    .replace(/,.*$/, '')
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')

/** A PictureBox with BorderStyle = Fixed3D and SizeMode = Zoom. */
export function PictureBox({ fighter }: { fighter: Fighter }) {
  return (
    <div className="picturebox" aria-hidden="true">
      {fighter.imageUrl ? (
        <img src={fighter.imageUrl} alt="" draggable={false} />
      ) : fighter.emoji ? (
        <span className="emoji">{fighter.emoji}</span>
      ) : (
        <span className="initials">{initials(fighter.name)}</span>
      )}
      {fighter.count > 1 && <span className="count">x{formatNumber(fighter.count)}</span>}
    </div>
  )
}

/** Small glyph for list rows: the image, the emoji, or initials. */
export function FighterGlyph({ fighter }: { fighter: Fighter }) {
  if (fighter.imageUrl) return <img src={fighter.imageUrl} alt="" className="glyph" />
  return <span className="glyph">{fighter.emoji ?? initials(fighter.name)}</span>
}
