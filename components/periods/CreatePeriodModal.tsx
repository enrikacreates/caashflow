'use client'

import { useState, useTransition } from 'react'
import { createBudgetPeriod } from '@/app/actions/periods'

export default function CreatePeriodModal({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const inputClass = 'w-full bg-bg-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-teal/40 transition-all shadow-card'

  // Default to next month — you're likely budgeting for next month, not this one
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const defaultMonthValue = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`
  const defaultName = `${monthNames[nextMonth.getMonth()]} ${nextMonth.getFullYear()}`

  const [periodName, setPeriodName] = useState(defaultName)

  // When the month picker changes, update the name suggestion
  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [year, month] = e.target.value.split('-').map(Number)
    if (year && month) {
      setPeriodName(`${monthNames[month - 1]} ${year}`)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await createBudgetPeriod(formData)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-white rounded-lg shadow-card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h2 font-semibold text-text-heading">New Budget</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-heading text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div>
            <label className="block text-sm font-bold text-text-heading mb-1">Budget Name *</label>
            <input
              type="text"
              name="period_name"
              required
              value={periodName}
              onChange={(e) => setPeriodName(e.target.value)}
              placeholder="e.g., Apr 2026"
              className={inputClass}
            />
            <p className="text-xs text-text-muted mt-1">
              Base budget items will be copied automatically.
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
