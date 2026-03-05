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
      <h1 className="text-h1 font-bold text-text-heading">No Budget Yet</h1>
    )
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 group"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <h1 className="text-h1 font-bold text-text-heading">
          {currentPeriod.period_name}
        </h1>
        <ChevronDown
          size={22}
          strokeWidth={2.5}
          className={`text-text-muted transition-transform duration-200 mt-1 ${open ? 'rotate-180' : ''}`}
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
