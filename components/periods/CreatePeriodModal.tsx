'use client'

import { useTransition } from 'react'
import { createBudgetPeriod } from '@/app/actions/periods'

export default function CreatePeriodModal({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const inputClass = 'w-full bg-white border border-line rounded-[12px] px-4 py-2.5 text-sm focus:outline-none focus:border-blue transition-colors'

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await createBudgetPeriod(formData)
      onClose()
    })
  }

  // Generate suggested name based on current date
  const now = new Date()
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const suggestedName = `${monthNames[now.getMonth()]} ${now.getFullYear()} - Period`

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[28px] p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black font-display text-ink">New Budget Period</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Period Name *</label>
            <input
              type="text"
              name="period_name"
              required
              defaultValue={suggestedName}
              placeholder="e.g., Jan 2026 - Period 1"
              className={inputClass}
            />
            <p className="text-xs text-muted mt-1">
              Base budget items will be copied into this period automatically.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-white text-ink border border-line rounded-[12px] px-5 py-2.5 font-bold hover:border-blue text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="bg-blue text-white rounded-[12px] px-5 py-2.5 font-bold hover:opacity-90 disabled:opacity-50 text-sm"
            >
              {isPending ? 'Creating...' : 'Create Period'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
