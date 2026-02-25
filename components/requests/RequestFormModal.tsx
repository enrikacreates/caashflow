'use client'

import { useTransition } from 'react'
import { createBudgetRequest, updateBudgetRequest } from '@/app/actions/requests'
import type { BudgetRequest, PriorityCategoryRecord } from '@/lib/types'

export default function RequestFormModal({
  editItem, onClose, categories,
}: { editItem: BudgetRequest | null; onClose: () => void; categories: PriorityCategoryRecord[] }) {
  const [isPending, startTransition] = useTransition()
  const inputClass = 'w-full bg-white border border-line rounded-[12px] px-4 py-2.5 text-sm focus:outline-none focus:border-blue transition-colors'

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
      <div className="bg-white rounded-[28px] p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black font-display text-ink">{editItem ? 'Edit Request' : 'Add Request'}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {editItem && <input type="hidden" name="id" value={editItem.id} />}
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Name *</label>
            <input type="text" name="name" required defaultValue={editItem?.name || ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Amount</label>
            <input type="number" name="amount" step="0.01" defaultValue={editItem?.amount || ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Priority</label>
            <select name="priority_category" defaultValue={editItem?.priority_category || (categories[0]?.name ?? '')} className={inputClass}>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Status</label>
            <select name="status" defaultValue={editItem?.status || 'requested'} className={inputClass}>
              <option value="requested">Requested</option>
              <option value="approved">Approved</option>
              <option value="purchased">Purchased</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Tags</label>
            <input type="text" name="tags" placeholder="Comma-separated" defaultValue={editItem?.tags?.join(', ') || ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Notes</label>
            <textarea name="notes" rows={2} defaultValue={editItem?.notes || ''} className={inputClass + ' resize-y'} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="bg-white text-ink border border-line rounded-[12px] px-5 py-2.5 font-bold hover:border-blue text-sm transition-colors">Cancel</button>
            <button type="submit" disabled={isPending} className="bg-blue text-white rounded-[12px] px-5 py-2.5 font-bold hover:opacity-90 disabled:opacity-50 text-sm">
              {isPending ? 'Saving...' : 'Save Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
