'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { updatePeriodExpenseDetails } from '@/app/actions/period-expenses'
import type { PeriodExpense, Account, PriorityCategoryRecord } from '@/lib/types'

export default function PeriodExpenseEditModal({
  expense, accounts, categories, onClose,
}: {
  expense: PeriodExpense
  accounts: Account[]
  categories: PriorityCategoryRecord[]
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const inputClass = 'w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors'

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const due = (fd.get('due_day') as string)?.trim()
    startTransition(async () => {
      await updatePeriodExpenseDetails(expense.id, {
        name: (fd.get('name') as string).trim(),
        default_amount: parseFloat(fd.get('default_amount') as string) || 0,
        account: ((fd.get('account') as string) || '').trim() || null,
        priority_category: ((fd.get('priority_category') as string) || '').trim() || null,
        due_day: due ? parseInt(due, 10) : null,
        pay_url: ((fd.get('pay_url') as string) || '').trim() || null,
        notes: ((fd.get('notes') as string) || '').trim() || null,
      })
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-white rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-h3 font-bold text-text-heading">Edit Expense</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-heading text-xl transition-colors">✕</button>
        </div>
        <p className="text-caption text-text-muted mb-5">Changes apply to this budget only — your baseline template stays untouched.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Name *</label>
            <input type="text" name="name" required defaultValue={expense.name} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Amount</label>
              <input type="number" name="default_amount" step="0.01" defaultValue={expense.default_amount || ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Due Day (1-31)</label>
              <input type="number" name="due_day" min="1" max="31" defaultValue={expense.due_day || ''} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Link (where to pay)</label>
            <input type="url" name="pay_url" placeholder="https://..." defaultValue={expense.pay_url || ''} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Account</label>
              <select name="account" defaultValue={expense.account || ''} className={inputClass}>
                <option value="">—</option>
                {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Priority</label>
              <select name="priority_category" defaultValue={expense.priority_category || ''} className={inputClass}>
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Notes</label>
            <textarea name="notes" rows={2} defaultValue={expense.notes || ''} className={inputClass + ' resize-y'} />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            {expense.base_item_id ? (
              <Link
                href={`/base-budget?edit=${expense.base_item_id}`}
                className="text-caption text-text-muted hover:text-primary font-semibold transition-colors"
              >
                Edit recurring item →
              </Link>
            ) : <span />}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="bg-bg-white text-text-heading border border-border rounded-full px-5 py-2.5 text-caption font-semibold hover:border-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
