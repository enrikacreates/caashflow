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
          className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-label font-bold hover:opacity-90 transition-opacity">
          + Add Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-bg-white rounded-lg shadow-card p-6">
          <div className="text-caption font-bold uppercase text-text-muted mb-1">Projected ({projected.length})</div>
          <div className="text-h3 font-bold text-text-heading">{formatCurrency(projected.reduce((s, i) => s + i.amount, 0))}</div>
        </div>
        <div className="bg-bg-white rounded-lg shadow-card p-6">
          <div className="text-caption font-bold uppercase text-text-muted mb-1">Sent ({sent.length})</div>
          <div className="text-h3 font-bold text-text-heading">{formatCurrency(sent.reduce((s, i) => s + i.amount, 0))}</div>
        </div>
        <div className="bg-bg-white rounded-lg shadow-card p-6">
          <div className="text-caption font-bold uppercase text-text-muted mb-1">Received ({received.length})</div>
          <div className="text-h3 font-bold text-green">{formatCurrency(received.reduce((s, i) => s + i.amount, 0))}</div>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#c9e5e4]">
              <tr>
                <th className="text-left text-caption font-bold uppercase text-text-muted px-4 py-3">Client</th>
                <th className="text-left text-caption font-bold uppercase text-text-muted px-4 py-3">Project</th>
                <th className="text-left text-caption font-bold uppercase text-text-muted px-4 py-3">Amount</th>
                <th className="text-left text-caption font-bold uppercase text-text-muted px-4 py-3">Status</th>
                <th className="text-left text-caption font-bold uppercase text-text-muted px-4 py-3">Projected</th>
                <th className="text-left text-caption font-bold uppercase text-text-muted px-4 py-3">Received</th>
                <th className="text-left text-caption font-bold uppercase text-text-muted px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">No invoices yet</td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv.id} className="odd:bg-bg-white even:bg-[#E8F5F4] hover:bg-[#E1DEEC] transition-colors">
                  <td className="px-4 py-3 text-caption font-medium text-text-heading">{inv.client_name}</td>
                  <td className="px-4 py-3 text-caption text-text-muted">{inv.project_name || '—'}</td>
                  <td className="px-4 py-3 text-caption font-bold text-text-heading">{formatCurrency(inv.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-3 py-1 rounded-full text-caption font-bold uppercase ${getStatusColor(inv.status)}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-caption text-text-muted">{formatDate(inv.projected_date)}</td>
                  <td className="px-4 py-3 text-caption text-text-muted">{formatDate(inv.actual_received_date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditItem(inv); setModalOpen(true) }}
                        className="text-caption text-primary font-semibold hover:underline">Edit</button>
                      <button onClick={() => handleDelete(inv.id, inv.client_name)} disabled={isPending}
                        className="text-caption text-text-muted hover:text-warning font-semibold transition-colors">Delete</button>
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
