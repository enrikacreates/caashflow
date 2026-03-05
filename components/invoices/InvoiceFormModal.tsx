'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { createInvoice, updateInvoice } from '@/app/actions/invoices'
import { linkInvoiceToPeriod } from '@/app/actions/period-expenses'
import type { Invoice, BudgetPeriod } from '@/lib/types'

export default function InvoiceFormModal({
  editItem, periods, onClose,
}: { editItem: Invoice | null; periods: BudgetPeriod[]; onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [isAssigning, startAssigning] = useTransition()

  const handleAssignToPeriod = (periodId: string) => {
    if (!periodId || !editItem) return
    startAssigning(() => linkInvoiceToPeriod(periodId, editItem.id))
  }

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

  // Grab the first linked period for the budget link
  const linkedPeriod = editItem?.period_linked_invoices?.[0]?.budget_periods ?? null

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-white rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h3 font-bold text-text-heading">{editItem ? 'Edit Income' : 'Add Income'}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-heading text-xl transition-colors">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {editItem && <input type="hidden" name="id" value={editItem.id} />}
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Source *</label>
            <input type="text" name="client_name" required defaultValue={editItem?.client_name || ''} placeholder="e.g. NuMoney, Mom, eBay sale…" className={inputClass} />
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Description</label>
            <input type="text" name="project_name" defaultValue={editItem?.project_name || ''} placeholder="e.g. Logo project, Birthday gift…" className={inputClass} />
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
              <label className="block text-caption font-semibold text-text-heading mb-1">Expected Date</label>
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
          {editItem?.status === 'received' && (
            <div className="border-t border-border pt-4">
              <label className="block text-caption font-semibold text-text-heading mb-1">Budget</label>
              {editItem.budgeted && linkedPeriod ? (
                <Link
                  href={`/periods/${linkedPeriod.id}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1 text-caption font-semibold text-primary hover:underline"
                >
                  {linkedPeriod.period_name} <span aria-hidden>→</span>
                </Link>
              ) : editItem.budgeted ? (
                <span className="text-caption text-text-muted">Assigned to a budget</span>
              ) : (
                <select
                  defaultValue=""
                  disabled={isAssigning}
                  onChange={(e) => handleAssignToPeriod(e.target.value)}
                  className="w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                >
                  <option value="" disabled>Assign to budget…</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>{p.period_name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="bg-bg-white text-text-heading border border-border rounded-full px-5 py-2.5 text-caption font-semibold hover:border-primary transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
