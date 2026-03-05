'use client'

import { useTransition } from 'react'
import { createBaseBudgetItem, updateBaseBudgetItem } from '@/app/actions/base-budget'
import type { BaseBudgetItem, Account, PriorityCategoryRecord } from '@/lib/types'
import { FREQUENCIES } from '@/lib/types'

export default function ExpenseFormModal({
  editItem,
  onClose,
  accounts,
  categories,
}: {
  editItem: BaseBudgetItem | null
  onClose: () => void
  accounts: Account[]
  categories: PriorityCategoryRecord[]
}) {
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      if (editItem) await updateBaseBudgetItem(formData)
      else await createBaseBudgetItem(formData)
      onClose()
    })
  }

  const inputClass = 'w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors'

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-white rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h3 font-bold text-text-heading">
            {editItem ? 'Edit Expense' : 'Add Expense'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-heading text-xl transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {editItem && <input type="hidden" name="id" value={editItem.id} />}

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Name *</label>
            <input type="text" name="name" required defaultValue={editItem?.name || ''} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Default Amount</label>
              <input type="number" name="default_amount" step="0.01" defaultValue={editItem?.default_amount || ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Due Day (1-31)</label>
              <input type="number" name="due_day" min="1" max="31" defaultValue={editItem?.due_day || ''} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Account</label>
            <select name="account" defaultValue={editItem?.account || ''} className={inputClass}>
              <option value="">Select Account</option>
              {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Priority</label>
            <select name="priority_category" defaultValue={editItem?.priority_category || ''} className={inputClass}>
              <option value="">Select Priority</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Frequency</label>
            <select name="frequency" defaultValue={editItem?.frequency || 'Monthly'} className={inputClass}>
              {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Tags</label>
            <input type="text" name="tags" placeholder="Comma-separated" defaultValue={editItem?.tags?.join(', ') || ''} className={inputClass} />
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" name="auto_pay" id="auto_pay" defaultChecked={editItem?.auto_pay || false}
              className="w-5 h-5 accent-primary-teal" />
            <label htmlFor="auto_pay" className="text-caption font-medium text-text-heading">Auto Pay</label>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Payment URL</label>
            <input type="text" name="pay_url" placeholder="https://..." defaultValue={editItem?.pay_url || ''} className={inputClass} />
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Notes</label>
            <textarea name="notes" rows={2} defaultValue={editItem?.notes || ''} className={inputClass + ' resize-y'} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="bg-bg-white text-text-heading border border-border rounded-full px-5 py-2.5 text-caption font-semibold hover:border-primary transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {isPending ? 'Saving…' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
