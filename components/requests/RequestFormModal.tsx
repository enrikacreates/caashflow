'use client'

import { useTransition } from 'react'
import { createBudgetRequest, updateBudgetRequest } from '@/app/actions/requests'
import type { BudgetRequest, PriorityCategoryRecord } from '@/lib/types'

export default function RequestFormModal({
  editItem, onClose, categories,
}: { editItem: BudgetRequest | null; onClose: () => void; categories: PriorityCategoryRecord[] }) {
  const [isPending, startTransition] = useTransition()
  const inputClass = 'w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors'

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      if (editItem) await updateBudgetRequest(formData)
      else await createBudgetRequest(formData)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-white rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h3 font-bold text-text-heading">{editItem ? 'Edit Next Buy' : 'Add to List'}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-heading text-xl transition-colors">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {editItem && <input type="hidden" name="id" value={editItem.id} />}
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Name *</label>
            <input type="text" name="name" required defaultValue={editItem?.name || ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Amount</label>
            <input type="number" name="amount" step="0.01" defaultValue={editItem?.amount || ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Priority</label>
            <select name="priority_category" defaultValue={editItem?.priority_category || (categories[0]?.name ?? '')} className={inputClass}>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Status</label>
            <select name="status" defaultValue={editItem?.status || 'requested'} className={inputClass}>
              <option value="requested">Requested</option>
              <option value="approved">Approved</option>
              <option value="purchased">Purchased</option>
            </select>
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Tags</label>
            <input type="text" name="tags" placeholder="Comma-separated" defaultValue={editItem?.tags?.join(', ') || ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Notes</label>
            <textarea name="notes" rows={2} defaultValue={editItem?.notes || ''} className={inputClass + ' resize-y'} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
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
        </form>
      </div>
    </div>
  )
}
