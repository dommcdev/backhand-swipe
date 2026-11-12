import { useQuery } from '@tanstack/react-query'
import { Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, ScrollRestoration } from 'react-router'
import { rankingsQuery } from './api/queries'
import { CloseGlyph, FormIcon, MenuStrip, MessageBoxHost, type Menu } from './components/win'
import { formatNumber } from './lib/format'
import { messageBox } from './lib/messageBox'
import { backColors, setBackColor, useBackColor } from './lib/palette'
import { setUnits, useUnits } from './lib/units'

const tabs = [
  { to: '/', label: 'Vote' },
  { to: '/rankings', label: 'Rankings' },
  { to: '/where-do-i-rank', label: 'Where do I rank?' },
]

type WindowState = 'normal' | 'maximized' | 'minimized'

async function tryToExit() {
  const answer = await messageBox('Are you sure you want to exit?', { caption: 'Exit', icon: 'question', buttons: ['Yes', 'No'] })
  if (answer === 'Yes') await messageBox('You can’t exit. There are still fights to vote on.', { icon: 'warning' })
}

export default function App() {
  const [state, setState] = useState<WindowState>('normal')
  const units = useUnits()
  const backColor = useBackColor()
  const win = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const offset = useRef({ x: 0, y: 0 })

  const menus: Menu[] = [
    { label: 'File', items: [{ label: 'Exit', shortcut: 'Alt+F4', onClick: tryToExit }] },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', disabled: true },
        'separator',
        { label: 'Cut', shortcut: 'Ctrl+X', disabled: true },
        { label: 'Copy', shortcut: 'Ctrl+C', disabled: true },
        { label: 'Paste', shortcut: 'Ctrl+V', disabled: true },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Metric', checked: units === 'metric', onClick: () => setUnits('metric') },
        { label: 'Imperial', checked: units === 'imperial', onClick: () => setUnits('imperial') },
        'separator',
        ...backColors.map((c) => ({
          label: `BackColor = ${c.name}`,
          checked: backColor === c.id,
          onClick: () => setBackColor(c.id),
        })),
      ],
    },
    {
      label: 'Help',
      items: [
        {
          label: 'How to play',
          onClick: () =>
            messageBox(
              'Pick who would win. Click the buttons, use the arrow keys, or swipe the fighters left or right. Down arrow skips.',
              { caption: 'How to play' },
            ),
        },
        'separator',
        {
          label: 'About Backhand Swipe...',
          onClick: () => messageBox('Backhand Swipe\nVersion 1.0.0.0\n\nIntro to Programming final project.\nPlease do not grade the colors.', { caption: 'About' }),
        },
      ],
    },
  ]

  function toggleMaximized() {
    offset.current = { x: 0, y: 0 }
    setState((s) => (s === 'maximized' ? 'normal' : 'maximized'))
  }

  // Dragging the title bar moves the window, but only on screens big enough to have a desktop.
  function onTitlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (state !== 'normal' || e.button !== 0 || (e.target as HTMLElement).closest('button') || innerWidth < 760) return
    drag.current = { x: e.clientX - offset.current.x, y: e.clientY - offset.current.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onTitlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    offset.current = { x: e.clientX - drag.current.x, y: Math.max(-40, e.clientY - drag.current.y) }
    win.current!.style.translate = `${offset.current.x}px ${offset.current.y}px`
  }

  return (
    <div className="desktop">
      <div
        ref={win}
        className={`window ${state}`}
        style={state === 'normal' ? undefined : { translate: 'none' }}
        hidden={state === 'minimized'}
      >
        <div
          className="titlebar"
          onPointerDown={onTitlePointerDown}
          onPointerMove={onTitlePointerMove}
          onPointerUp={() => (drag.current = null)}
          onDoubleClick={(e) => !(e.target as HTMLElement).closest('button') && toggleMaximized()}
        >
          <FormIcon />
          <span className="title">Form1 - Backhand Swipe</span>
          <button type="button" className="caption-btn" aria-label="Minimize" onClick={() => setState('minimized')}>
            <svg viewBox="0 0 10 10" aria-hidden="true" width="10" height="10">
              <path d="M0 5.5h10" stroke="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="caption-btn"
            aria-label={state === 'maximized' ? 'Restore' : 'Maximize'}
            onClick={toggleMaximized}
          >
            <svg viewBox="0 0 10 10" aria-hidden="true" width="10" height="10">
              {state === 'maximized' ? (
                <path d="M.5 2.5h7v7h-7zM2.5 2.5v-2h7v7h-2" fill="none" stroke="currentColor" />
              ) : (
                <path d="M.5.5h9v9h-9z" fill="none" stroke="currentColor" />
              )}
            </svg>
          </button>
          <button type="button" className="caption-btn close" aria-label="Close" onClick={tryToExit}>
            <CloseGlyph />
          </button>
        </div>

        <MenuStrip menus={menus} />

        <div className="tabcontrol">
          <nav className="tabs" aria-label="Sections">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end className="tab">
                {tab.label}
              </NavLink>
            ))}
          </nav>
          <main className="tabpage">
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </main>
        </div>

        <StatusStrip />
      </div>

      <Taskbar minimized={state === 'minimized'} onToggle={() => setState((s) => (s === 'minimized' ? 'normal' : 'minimized'))} />
      <MessageBoxHost />
      <ScrollRestoration />
    </div>
  )
}

function StatusStrip() {
  const { data, isFetching } = useQuery(rankingsQuery())
  const units = useUnits()
  return (
    <footer className="statusstrip">
      <span className="grow">{isFetching ? 'Loading...' : 'Ready'}</span>
      <span className="panel">{data ? `${formatNumber(data.totalVotes)} votes cast` : '0 votes cast'}</span>
      <span className="panel">{units === 'metric' ? 'Metric' : 'Imperial'}</span>
      <span className="grip" aria-hidden="true" />
    </footer>
  )
}

const clock = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

function Taskbar({ minimized, onToggle }: { minimized: boolean; onToggle: () => void }) {
  const [time, setTime] = useState(clock)
  useEffect(() => {
    const id = setInterval(() => setTime(clock()), 15_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="taskbar">
      <button type="button" className={`task ${minimized ? '' : 'active'}`} onClick={onToggle}>
        <FormIcon />
        Form1 - Backhand Swipe
      </button>
      <span className="clock">{time}</span>
    </div>
  )
}
