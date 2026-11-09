'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * "7/12 tracked": months this year where a budget actually got used. Opens to one
 * numbered circle per month so the streak of real use is the thing you see.
 */
export default function TrackedMonths({ months, year, currentMonth }: {
  // Month indexes (0-11) with at least one bill funded, paid, or cleared
  months: number[]
  year: number
  currentMonth: number
}) {
  const [open, setOpen] = useState(false)
  const tracked = new Set(months)
  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3"
      >
        <span className="flex items-center gap-1 text-caption font-bold text-text-heading">
          {tracked.size}/12 tracked
          <ChevronDown size={16} aria-hidden="true" className={`text-text-muted transition-transform ${open ? '' : '-rotate-90'}`} />
          {tracked.size === 12 && <span className="ml-1 font-semibold text-primary-teal">Every month!</span>}
        </span>
        <span className="text-[11px] text-text-muted">{year}</span>
      </button>
      {open && (
        <ol className="grid grid-cols-12 gap-1 mt-3" aria-label={`${tracked.size} of 12 months tracked in ${year}`}>
          {MONTH_LABELS.map((label, i) => {
            const on = tracked.has(i)
            const fill = on
              ? 'bg-primary-teal text-text-inverse'
              : i < currentMonth
                ? 'bg-surface-beige text-text-muted'
                : i === currentMonth
                  ? 'bg-surface-mint text-primary-teal'
                  : 'bg-bg-cream text-text-muted/60'
            return (
              <li key={label} className="flex flex-col items-center gap-1 min-w-0" aria-label={`${label}${on ? ', tracked' : ''}`}>
                <span className={`w-full aspect-square rounded-full flex items-center justify-center text-[11px] font-bold ${fill}`}>{i + 1}</span>
                <span className={`text-[9px] sm:text-[11px] leading-none ${on ? 'font-semibold text-text-heading' : 'text-text-muted'}`}>{label}</span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
