'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Pencil } from 'lucide-react'
import EditPeriodModal from '@/components/periods/EditPeriodModal'
import type { BudgetPeriod } from '@/lib/types'

/**
 * Heading + hot-link picker for the budget-period detail page.
 * Clicking the period name reveals a dropdown of OTHER active budgets — one tap
 * to jump between them without going back through the budgets list.
 */
export default function PeriodPicker({
  current,
  periods,
}: {
  current: BudgetPeriod
  periods: BudgetPeriod[]
}) {
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Click outside / Escape closes the dropdown
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Other active budgets only — current period and any completed ones drop out
  const others = periods
    .filter((p) => p.id !== current.id && p.status !== 'complete')
    .sort((a, b) => (a.period_month ?? '').localeCompare(b.period_month ?? ''))

  return (
    <div ref={wrapRef} className="relative inline-flex items-baseline gap-3">
      <button
        type="button"
        onClick={() => others.length > 0 && setOpen((v) => !v)}
        disabled={others.length === 0}
        title={others.length > 0 ? 'Jump to another active budget' : 'No other active budgets'}
        className="inline-flex items-baseline gap-2 text-h1 font-bold text-text-heading hover:text-primary transition-colors disabled:hover:text-text-heading disabled:cursor-default text-left"
      >
        <span>{current.kind === 'event' && <span aria-hidden className="mr-1.5">✨</span>}{current.period_name}</span>
        {others.length > 0 && (
          <ChevronDown size={24} strokeWidth={2.5} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        title="Edit budget (name, type, month)"
        className="text-text-muted hover:text-primary transition-colors translate-y-[-2px]"
      >
        <Pencil size={16} strokeWidth={2} />
      </button>

      {editOpen && <EditPeriodModal period={current} onClose={() => setEditOpen(false)} />}

      {open && others.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-30 min-w-[14rem] bg-bg-white rounded-lg shadow-lg p-1.5">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-text-muted tracking-wide">Other active budgets</div>
          <ul className="space-y-0.5">
            {others.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/periods/${p.id}`}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 rounded-sm text-caption font-semibold text-text-heading hover:bg-surface-beige hover:text-primary transition-colors"
                >
                  {p.kind === 'event' && <span aria-hidden className="mr-1">✨</span>}{p.period_name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
