'use client'

import { useState, useTransition } from 'react'
import { updateBudgetPeriod } from '@/app/actions/periods'
import type { BudgetPeriod } from '@/lib/types'

type Kind = 'monthly' | 'event'

export default function EditPeriodModal({ period, onClose }: { period: BudgetPeriod; onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const inputClass = 'w-full bg-bg-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-teal/40 transition-all shadow-card'

  const monthValue = period.period_month ? period.period_month.slice(0, 7) : ''
  const createdValue = period.created_at ? period.created_at.slice(0, 10) : ''

  const [kind, setKind] = useState<Kind>(period.kind ?? 'monthly')
  const [name, setName] = useState(period.period_name)
  const [month, setMonth] = useState(monthValue)
  const [created, setCreated] = useState(createdValue)

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMonth(e.target.value)
    const [year, m] = e.target.value.split('-').map(Number)
    if (year && m) setName(`${monthNames[m - 1]} ${year}`)
  }

  const switchKind = (next: Kind) => {
    if (next === kind) return
    setKind(next)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Converting to monthly with no month set — give the user a chance to pick one
    // rather than silently saving a monthly budget that won't sort properly.
    if (kind === 'monthly' && !month) {
      const ok = confirm('No budget month set. Save anyway? (you can edit later)')
      if (!ok) return
    }
    startTransition(async () => {
      await updateBudgetPeriod(period.id, {
        period_name: name.trim() || period.period_name,
        period_month: kind === 'event' ? null : (month || null),
        kind,
        created_at: created ? `${created}T12:00:00.000Z` : undefined,
      })
      onClose()
    })
  }

  const kindBtn = (k: Kind, label: string, hint: string) => (
    <button
      type="button"
      onClick={() => switchKind(k)}
      className={`flex-1 rounded-lg px-4 py-3 text-left transition-all shadow-card ${
        kind === k ? 'bg-primary-teal text-white' : 'bg-bg-white text-text-heading hover:opacity-80'
      }`}
    >
      <div className="text-sm font-bold">{label}</div>
      <div className={`text-[11px] mt-0.5 ${kind === k ? 'text-white/80' : 'text-text-muted'}`}>{hint}</div>
    </button>
  )

  const initialKind = period.kind ?? 'monthly'
  const kindChanged = kind !== initialKind

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-white rounded-lg shadow-card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h2 font-semibold text-text-heading">Edit Budget</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-heading text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-text-heading mb-2">Budget Type</label>
            <div className="flex gap-2">
              {kindBtn('monthly', 'Monthly', 'Regular pay-period budget')}
              {kindBtn('event', 'Event ✨', 'Party, vacation, trip')}
            </div>
            {kindChanged && (
              <p className="text-xs text-primary-teal mt-2">
                {kind === 'event'
                  ? '→ Converting to Event: tithe, deductions, and savings rollups will hide. Your expenses stay put.'
                  : '→ Converting to Monthly: tithe/deductions sections will reappear and this budget will roll up to the dashboard.'}
              </p>
            )}
          </div>

          {kind === 'monthly' && (
            <div>
              <label className="block text-sm font-bold text-text-heading mb-1">Budget Month</label>
              <input type="month" value={month} onChange={handleMonthChange} className={inputClass} />
              <p className="text-xs text-text-muted mt-1">Drives ordering and which budget shows as “Latest”.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-text-heading mb-1">Budget Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === 'event' ? 'e.g., Avari Grad Party' : 'e.g., Apr 2026'}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-text-heading mb-1">Created Date</label>
            <input type="date" value={created} onChange={(e) => setCreated(e.target.value)} className={inputClass} />
            <p className="text-xs text-text-muted mt-1">The date shown on the card and used to order the budgets list.</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-bg-white text-text-heading rounded-full px-5 py-2.5 font-bold text-sm shadow-card hover:opacity-80 transition-opacity"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="bg-primary-teal text-white rounded-full px-5 py-2.5 font-bold hover:opacity-90 disabled:opacity-50 text-sm"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
