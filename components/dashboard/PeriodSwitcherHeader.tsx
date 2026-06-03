'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

type Period = {
  id: string
  period_name: string
  kind?: 'monthly' | 'event'
  period_month?: string | null
  created_at?: string | null
}

export default function PeriodSwitcherHeader({
  currentPeriod,
  allPeriods,
}: {
  currentPeriod: Period | null
  allPeriods: Period[]
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  // Most-recent first. Monthly budgets sort by period_month (a real date);
  // events have no period_month so fall back to created_at.
  const sortKey = (p: Period) => p.period_month || p.created_at || ''
  const sortedPeriods = [...allPeriods].sort((a, b) => sortKey(b).localeCompare(sortKey(a)))

  const handleSelectMonthly = (id: string) => {
    setOpen(false)
    router.push(`/?period=${id}`)
  }

  if (!currentPeriod) {
    return (
      <div>
        <h1 className="text-h2 font-semibold text-text-heading">Latest Budget</h1>
        <p className="text-sm text-text-muted mt-0.5">No budget yet</p>
      </div>
    )
  }

  return (
    <div className="relative inline-block">
      <h1 className="text-h2 font-semibold text-text-heading">Latest Budget</h1>
      <div className="flex items-center gap-1.5 mt-0.5">
        <Link
          href={`/periods/${currentPeriod.id}`}
          className="text-sm font-semibold text-primary underline hover:opacity-80 transition-opacity"
          title="Open this budget"
        >
          {currentPeriod.period_name}
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="group"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Switch budget"
        >
          <ChevronDown
            size={14}
            strokeWidth={2.5}
            className={`text-text-muted hover:text-text-heading transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-2 bg-bg-white rounded-lg shadow-card z-20 min-w-[200px] overflow-hidden">
            {sortedPeriods.length === 0 ? (
              <p className="px-4 py-3 text-sm text-text-muted">No budgets yet</p>
            ) : (
              sortedPeriods.map((p) => {
                const isEvent = p.kind === 'event'
                const isCurrent = p.id === currentPeriod.id
                const itemClass = `w-full text-left px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-beige ${
                  isCurrent ? 'text-primary-teal font-semibold bg-surface-mint' : 'text-text-heading'
                }`
                // Event budgets navigate to their detail page — they don't make sense
                // as a dashboard "view" because the dashboard rolls up monthly numbers.
                if (isEvent) {
                  return (
                    <Link
                      key={p.id}
                      href={`/periods/${p.id}`}
                      onClick={() => setOpen(false)}
                      className={`${itemClass} flex items-center gap-1.5`}
                    >
                      <span aria-hidden>✨</span>
                      <span className="truncate">{p.period_name}</span>
                    </Link>
                  )
                }
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectMonthly(p.id)}
                    className={itemClass}
                  >
                    {p.period_name}
                  </button>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
