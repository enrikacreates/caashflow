'use client'

import { useTransition } from 'react'
import { createInvoice, updateInvoice } from '@/app/actions/invoices'
import type { Invoice } from '@/lib/types'

export default function InvoiceFormModal({
  editItem, onClose,
}: { editItem: Invoice | null; onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const inputClass = 'w-full bg-white border border-line rounded-[12px] px-4 py-2.5 text-sm focus:outline-none focus:border-blue transition-colors'

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
      <div className="bg-white rounded-[28px] p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black font-display text-ink">{editItem ? 'Edit Invoice' : 'Add Invoice'}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {editItem && <input type="hidden" name="id" value={editItem.id} />}
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Client Name *</label>
            <input type="text" name="client_name" required defaultValue={editItem?.client_name || ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Project Name</label>
            <input type="text" name="project_name" defaultValue={editItem?.project_name || ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Amount</label>
            <input type="number" name="amount" step="0.01" defaultValue={editItem?.amount || ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Status</label>
            <select name="status" defaultValue={editItem?.status || 'projected'} className={inputClass}>
              <option value="projected">Projected</option>
              <option value="sent">Sent</option>
              <option value="received">Received</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-ink mb-1">Projected Date</label>
              <input type="date" name="projected_date" defaultValue={editItem?.projected_date || ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink mb-1">Received Date</label>
              <input type="date" name="actual_received_date" defaultValue={editItem?.actual_received_date || ''} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Month</label>
            <input type="month" name="month" defaultValue={editItem?.month || ''} className={inputClass} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="bg-white text-ink border border-line rounded-[12px] px-5 py-2.5 font-bold hover:border-blue text-sm transition-colors">Cancel</button>
            <button type="submit" disabled={isPending} className="bg-blue text-white rounded-[12px] px-5 py-2.5 font-bold hover:opacity-90 disabled:opacity-50 text-sm">
              {isPending ? 'Saving...' : 'Save Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
