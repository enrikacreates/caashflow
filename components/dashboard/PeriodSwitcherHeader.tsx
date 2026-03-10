'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

type Period = { id: string; period_name: string }

export default function PeriodSwitcherHeader({
  currentPeriod,
  allPeriods,
}: {
  currentPeriod: Period | null
  allPeriods: Period[]
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleSelect = (id: string) => {
    setOpen(false)
    router.push(`/?period=${id}`)
  }

  if (!currentPeriod) {
    return (
      <div>
        <h1 className="text-h1 font-bold text-text-heading">Latest</h1>
        <p className="text-sm text-text-muted mt-0.5">No budget yet</p>
      </div>
    )
  }

  return (
    <div className="relative inline-block">
      <h1 className="text-h1 font-bold text-text-heading">Latest</h1>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 group mt-0.5"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-text-muted">
          {currentPeriod.period_name}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          className={`text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-2 bg-bg-white rounded-lg shadow-card z-20 min-w-[200px] overflow-hidden">
            {allPeriods.length === 0 ? (
              <p className="px-4 py-3 text-sm text-text-muted">No budgets yet</p>
            ) : (
              allPeriods.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p.id)}
                  className={`
                    w-full text-left px-4 py-3 text-sm font-medium transition-colors
                    hover:bg-surface-beige
                    ${p.id === currentPeriod.id
                      ? 'text-primary-teal font-semibold bg-surface-mint'
                      : 'text-text-heading'
                    }
                  `}
                >
                  {p.period_name}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
