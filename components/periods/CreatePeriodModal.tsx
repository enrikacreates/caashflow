'use client'

import { useState, useTransition } from 'react'
import { createBudgetPeriod } from '@/app/actions/periods'

type Kind = 'monthly' | 'event'

export default function CreatePeriodModal({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const inputClass = 'w-full bg-bg-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-teal/40 transition-all shadow-card'

  // Default to next month — you're likely budgeting for next month, not this one
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const defaultMonthValue = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`
  const defaultMonthlyName = `${monthNames[nextMonth.getMonth()]} ${nextMonth.getFullYear()}`

  const [kind, setKind] = useState<Kind>('monthly')
  const [periodName, setPeriodName] = useState(defaultMonthlyName)

  // When the month picker changes, update the name suggestion
  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [year, month] = e.target.value.split('-').map(Number)
    if (year && month) {
      setPeriodName(`${monthNames[month - 1]} ${year}`)
    }
  }

  const switchKind = (next: Kind) => {
    if (next === kind) return
    setKind(next)
    // Reset name to a sensible default for the new mode (only if the user
    // hasn't customized it yet — i.e. it still matches the other mode's default).
    if (next === 'event' && periodName === defaultMonthlyName) setPeriodName('')
    if (next === 'monthly' && periodName === '') setPeriodName(defaultMonthlyName)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('kind', kind)
    startTransition(async () => {
      await createBudgetPeriod(formData)
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

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-white rounded-lg shadow-card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h2 font-semibold text-text-heading">New Budget</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-heading text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-text-heading mb-2">Budget Type</label>
            <div className="flex gap-2">
              {kindBtn('monthly', 'Monthly', 'Regular pay-period budget')}
              {kindBtn('event', 'Event ✨', 'Party, vacation, trip')}
            </div>
          </div>

          {kind === 'monthly' && (
            <div>
              <label className="block text-sm font-bold text-text-heading mb-1">Budget Month *</label>
              <input
                type="month"
                name="period_month"
                required
                defaultValue={defaultMonthValue}
                onChange={handleMonthChange}
                className={inputClass}
              />
              <p className="text-xs text-text-muted mt-1">
                Which month are you budgeting for?
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-text-heading mb-1">Budget Name *</label>
            <input
              type="text"
              name="period_name"
              required
              value={periodName}
              onChange={(e) => setPeriodName(e.target.value)}
              placeholder={kind === 'event' ? 'e.g., Grad Party, Sacramento Trip' : 'e.g., Apr 2026'}
              className={inputClass}
            />
            <p className="text-xs text-text-muted mt-1">
              {kind === 'event'
                ? 'Starts empty — add only the expenses for this event. Income, tithing, and savings rollups stay isolated from your monthly budget.'
                : 'Base budget items will be copied automatically.'}
            </p>
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
              {isPending ? 'Creating...' : 'Create Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
