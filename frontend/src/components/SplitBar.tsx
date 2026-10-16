import { percent } from '../lib/format'

interface SplitBarProps {
  leftLabel: string
  rightLabel: string
  leftVotes: number
  rightVotes: number
  className?: string
}

/** Red-corner versus blue-corner share of the vote. With no votes it sits at an unlabeled 50/50. */
export function SplitBar({ leftLabel, rightLabel, leftVotes, rightVotes, className = 'h-[36px]' }: SplitBarProps) {
  const total = leftVotes + rightVotes
  const leftPct = total ? percent(leftVotes, total) : 50
  const rightPct = 100 - leftPct
  const label = `outlined text-[1.05rem] font-black whitespace-nowrap italic transition-opacity duration-300 ${total ? '' : 'opacity-0'}`

  return (
    <div
      role="img"
      aria-label={total ? `${leftLabel} ${leftPct}%, ${rightLabel} ${rightPct}%` : 'No vote yet'}
      className={`flex gap-[3px] overflow-hidden rounded-full bg-slate shadow-lift-sm ${className}`}
    >
      <span
        className="stripes flex min-w-14 items-center bg-corner-l pl-3.5 transition-[flex-basis] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ flexBasis: `${leftPct}%` }}
      >
        <span className={label}>{leftPct}%</span>
      </span>
      <span className="stripes flex min-w-14 grow items-center justify-end bg-corner-r pr-3.5">
        <span className={label}>{rightPct}%</span>
      </span>
    </div>
  )
}
