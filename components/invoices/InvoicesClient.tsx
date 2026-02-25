'use client'

import { useState, useTransition } from 'react'
import { deleteInvoice } from '@/app/actions/invoices'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import type { Invoice } from '@/lib/types'
import InvoiceFormModal from './InvoiceFormModal'

export default function InvoicesClient({ invoices }: { invoices: Invoice[] }) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Invoice | null>(null)

  const projected = invoices.filter((i) => i.status === 'projected')
  const sent = invoices.filter((i) => i.status === 'sent')
  const received = invoices.filter((i) => i.status === 'received')

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete invoice for "${name}"?`)) return
    startTransition(() => deleteInvoice(id))
  }

  return (
    <>
      <div className="flex mb-6">
        <button onClick={() => { setEditItem(null); setModalOpen(true) }}
          className="bg-blue text-white rounded-[12px] px-5 py-2.5 font-bold hover:opacity-90 text-sm">
          + Add Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-line rounded-[20px] p-6">
          <div className="text-xs font-bold uppercase text-muted mb-1">Projected ({projected.length})</div>
          <div className="text-lg font-bold text-ink">{formatCurrency(projected.reduce((s, i) => s + i.amount, 0))}</div>
        </div>
        <div className="bg-white border border-line rounded-[20px] p-6">
          <div className="text-xs font-bold uppercase text-muted mb-1">Sent ({sent.length})</div>
          <div className="text-lg font-bold text-ink">{formatCurrency(sent.reduce((s, i) => s + i.amount, 0))}</div>
        </div>
        <div className="bg-white border border-line rounded-[20px] p-6">
          <div className="text-xs font-bold uppercase text-muted mb-1">Received ({received.length})</div>
          <div className="text-lg font-bold text-green">{formatCurrency(received.reduce((s, i) => s + i.amount, 0))}</div>
        </div>
      </div>

      <div className="bg-white border border-line rounded-[20px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream-2">
              <tr>
                <th className="text-left text-xs font-bold uppercase text-ink px-4 py-3">Client</th>
                <th className="text-left text-xs font-bold uppercase text-ink px-4 py-3">Project</th>
                <th className="text-left text-xs font-bold uppercase text-ink px-4 py-3">Amount</th>
                <th className="text-left text-xs font-bold uppercase text-ink px-4 py-3">Status</th>
                <th className="text-left text-xs font-bold uppercase text-ink px-4 py-3">Projected</th>
                <th className="text-left text-xs font-bold uppercase text-ink px-4 py-3">Received</th>
                <th className="text-left text-xs font-bold uppercase text-ink px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No invoices yet</td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-line hover:bg-cream transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{inv.client_name}</td>
                  <td className="px-4 py-3 text-sm text-muted">{inv.project_name || '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold">{formatCurrency(inv.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(inv.status)}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">{formatDate(inv.projected_date)}</td>
                  <td className="px-4 py-3 text-sm text-muted">{formatDate(inv.actual_received_date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditItem(inv); setModalOpen(true) }}
                        className="text-xs text-blue font-bold hover:underline">Edit</button>
                      <button onClick={() => handleDelete(inv.id, inv.client_name)} disabled={isPending}
                        className="text-xs text-orange font-bold hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <InvoiceFormModal editItem={editItem} onClose={() => { setModalOpen(false); setEditItem(null) }} />
      )}
    </>
  )
}
