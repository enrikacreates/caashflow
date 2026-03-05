'use client'

import { useTransition } from 'react'
import { createInvoice, updateInvoice } from '@/app/actions/invoices'
import type { Invoice } from '@/lib/types'

export default function InvoiceFormModal({
  editItem, onClose,
}: { editItem: Invoice | null; onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const inputClass = 'w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors'

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      if (editItem) await updateInvoice(formData)
      else await createInvoice(formData)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-white rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h3 font-bold text-text-heading">{editItem ? 'Edit Invoice' : 'Add Invoice'}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-heading text-xl transition-colors">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {editItem && <input type="hidden" name="id" value={editItem.id} />}
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Client Name *</label>
            <input type="text" name="client_name" required defaultValue={editItem?.client_name || ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Project Name</label>
            <input type="text" name="project_name" defaultValue={editItem?.project_name || ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Amount</label>
            <input type="number" name="amount" step="0.01" defaultValue={editItem?.amount || ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Status</label>
            <select name="status" defaultValue={editItem?.status || 'projected'} className={inputClass}>
              <option value="projected">Projected</option>
              <option value="sent">Sent</option>
              <option value="received">Received</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Projected Date</label>
              <input type="date" name="projected_date" defaultValue={editItem?.projected_date || ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Received Date</label>
              <input type="date" name="actual_received_date" defaultValue={editItem?.actual_received_date || ''} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Month</label>
            <input type="month" name="month" defaultValue={editItem?.month || ''} className={inputClass} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="bg-bg-white text-text-heading border border-border rounded-full px-5 py-2.5 text-caption font-semibold hover:border-primary transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {isPending ? 'Saving…' : 'Save Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
