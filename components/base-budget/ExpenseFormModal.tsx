'use client'

import { useTransition } from 'react'
import { createBaseBudgetItem, updateBaseBudgetItem } from '@/app/actions/base-budget'
import type { BaseBudgetItem } from '@/lib/types'
import { PRIORITY_CATEGORIES, FREQUENCIES, ACCOUNTS } from '@/lib/types'

export default function ExpenseFormModal({
  editItem,
  onClose,
}: {
  editItem: BaseBudgetItem | null
  onClose: () => void
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

  const inputClass = 'w-full bg-white border border-line rounded-[12px] px-4 py-2.5 text-sm focus:outline-none focus:border-blue transition-colors'

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[28px] p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black font-display text-ink">
            {editItem ? 'Edit Expense' : 'Add Expense'}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {editItem && <input type="hidden" name="id" value={editItem.id} />}

          <div>
            <label className="block text-sm font-bold text-ink mb-1">Name *</label>
            <input type="text" name="name" required defaultValue={editItem?.name || ''} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-ink mb-1">Default Amount</label>
              <input type="number" name="default_amount" step="0.01" defaultValue={editItem?.default_amount || ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink mb-1">Due Day (1-31)</label>
              <input type="number" name="due_day" min="1" max="31" defaultValue={editItem?.due_day || ''} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-ink mb-1">Account</label>
            <select name="account" defaultValue={editItem?.account || ''} className={inputClass}>
              <option value="">Select Account</option>
              {ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-ink mb-1">Priority</label>
            <select name="priority_category" defaultValue={editItem?.priority_category || ''} className={inputClass}>
              <option value="">Select Priority</option>
              {PRIORITY_CATEGORIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-ink mb-1">Frequency</label>
            <select name="frequency" defaultValue={editItem?.frequency || 'Monthly'} className={inputClass}>
              {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-ink mb-1">Tags</label>
            <input type="text" name="tags" placeholder="Comma-separated" defaultValue={editItem?.tags?.join(', ') || ''} className={inputClass} />
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" name="auto_pay" id="auto_pay" defaultChecked={editItem?.auto_pay || false}
              className="w-5 h-5 accent-blue" />
            <label htmlFor="auto_pay" className="text-sm font-medium">Auto Pay</label>
          </div>

          <div>
            <label className="block text-sm font-bold text-ink mb-1">Payment URL</label>
            <input type="text" name="pay_url" placeholder="https://..." defaultValue={editItem?.pay_url || ''} className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-bold text-ink mb-1">Notes</label>
            <textarea name="notes" rows={2} defaultValue={editItem?.notes || ''} className={inputClass + ' resize-y'} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="bg-white text-ink border border-line rounded-[12px] px-5 py-2.5 font-bold hover:border-blue text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="bg-blue text-white rounded-[12px] px-5 py-2.5 font-bold hover:opacity-90 disabled:opacity-50 text-sm">
              {isPending ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
