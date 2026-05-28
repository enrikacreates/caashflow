'use client'

import { useMemo, useState, useTransition } from 'react'
import { deleteInvoice, addIncomeToBudget, updateInvoiceStatus } from '@/app/actions/invoices'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import type { Invoice, BudgetPeriod } from '@/lib/types'
import InvoiceFormModal from './InvoiceFormModal'

type SortKey = 'client_name' | 'project_name' | 'amount' | 'status' | 'projected_date' | 'actual_received_date'
type SortDir = 'asc' | 'desc'

// Status order so the Status column sorts in a meaningful pipeline progression
const STATUS_ORDER: Record<Invoice['status'], number> = { projected: 0, sent: 1, received: 2 }

export default function InvoicesClient({
  invoices,
  periods,
}: {
  invoices: Invoice[]
  periods: BudgetPeriod[]
}) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Invoice | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('projected_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const projected = invoices.filter((i) => i.status === 'projected')
  const sent = invoices.filter((i) => i.status === 'sent')
  const received = invoices.filter((i) => i.status === 'received')

  const byMonthDesc = (a: BudgetPeriod, b: BudgetPeriod) =>
    (b.period_month ?? '').localeCompare(a.period_month ?? '')
  const targetPeriod =
    [...periods].filter((p) => p.status === 'active').sort(byMonthDesc)[0] ??
    [...periods].sort(byMonthDesc)[0] ??
    null

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete invoice for "${name}"?`)) return
    startTransition(() => deleteInvoice(id))
  }

  const handleAddToBudget = (id: string) => {
    if (!targetPeriod) return
    startTransition(() => addIncomeToBudget(id, targetPeriod.id))
  }

  const handleStatusChange = (id: string, status: 'projected' | 'sent' | 'received') => {
    startTransition(() => updateInvoiceStatus(id, status))
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    const mul = sortDir === 'asc' ? 1 : -1
    return [...invoices].sort((a, b) => {
      if (sortKey === 'amount') return (a.amount - b.amount) * mul
      if (sortKey === 'status') return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * mul
      const av = (a[sortKey] ?? '') as string
      const bv = (b[sortKey] ?? '') as string
      return av.localeCompare(bv) * mul
    })
  }, [invoices, sortKey, sortDir])

  const thClass = (key: SortKey) =>
    `text-left text-caption font-bold uppercase text-text-muted px-4 py-3 cursor-pointer select-none hover:text-primary transition-colors ${
      sortKey === key ? 'text-primary' : ''
    }`
  const sortMark = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
  // Helper: child interactive elements stop bubbling so the row's edit-click doesn't fire too
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <>
      <div className="flex mb-6">
        <button onClick={() => { setEditItem(null); setModalOpen(true) }}
          className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-label font-bold hover:opacity-90 transition-opacity">
          + Add Income
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
            <thead className="bg-bg-white border-b border-[#e9e9e9]">
              <tr>
                <th className={thClass('client_name')} onClick={() => toggleSort('client_name')}>Source{sortMark('client_name')}</th>
                <th className={thClass('project_name')} onClick={() => toggleSort('project_name')}>Description{sortMark('project_name')}</th>
                <th className={thClass('amount')} onClick={() => toggleSort('amount')}>Amount{sortMark('amount')}</th>
                <th className={thClass('status')} onClick={() => toggleSort('status')}>Status{sortMark('status')}</th>
                <th className={thClass('projected_date')} onClick={() => toggleSort('projected_date')}>Projected{sortMark('projected_date')}</th>
                <th className={thClass('actual_received_date')} onClick={() => toggleSort('actual_received_date')}>Received{sortMark('actual_received_date')}</th>
                <th className="text-left text-caption font-bold uppercase text-text-muted px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">No invoices yet</td></tr>
              ) : sorted.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => { setEditItem(inv); setModalOpen(true) }}
                  title="Click to edit"
                  className="odd:bg-bg-white even:bg-[#ebf0f0] hover:bg-[#f2e9e9] transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-caption font-medium text-text-heading underline decoration-dotted decoration-text-muted underline-offset-4">{inv.client_name}</td>
                  <td className="px-4 py-3 text-caption text-text-muted">{inv.project_name || '—'}</td>
                  <td className="px-4 py-3 text-caption font-bold text-text-heading">{formatCurrency(inv.amount)}</td>
                  <td className="px-4 py-3" onClick={stop}>
                    <select
                      value={inv.status}
                      disabled={isPending}
                      onClick={stop}
                      onChange={(e) => handleStatusChange(inv.id, e.target.value as 'projected' | 'sent' | 'received')}
                      className={`appearance-none cursor-pointer px-3 py-1 pr-6 rounded-full text-caption font-bold uppercase focus:outline-none bg-[right_0.5rem_center] bg-no-repeat ${getStatusColor(inv.status)}`}
                      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='6' viewBox='0 0 8 6'%3E%3Cpath fill='%23333' d='M0 0l4 5 4-5z'/%3E%3C/svg%3E\")" }}
                    >
                      <option value="projected">Projected</option>
                      <option value="sent">Sent</option>
                      <option value="received">Received</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-caption text-text-muted">{formatDate(inv.projected_date)}</td>
                  <td className="px-4 py-3 text-caption text-text-muted">{formatDate(inv.actual_received_date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {inv.budgeted ? (
                        <span className="text-caption text-text-muted font-semibold">✓ Budgeted</span>
                      ) : (
                        <button onClick={(e) => { stop(e); handleAddToBudget(inv.id) }} disabled={isPending || !targetPeriod}
                          title={targetPeriod ? `Add to ${targetPeriod.period_name}` : 'Create a budget first'}
                          className="text-caption text-primary-teal font-semibold hover:underline disabled:opacity-40 disabled:cursor-not-allowed">
                          Add to budget
                        </button>
                      )}
                      <button onClick={(e) => { stop(e); setEditItem(inv); setModalOpen(true) }}
                        className="text-caption text-primary font-semibold hover:underline">Edit</button>
                      <button onClick={(e) => { stop(e); handleDelete(inv.id, inv.client_name) }} disabled={isPending}
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
        <InvoiceFormModal editItem={editItem} periods={periods} onClose={() => { setModalOpen(false); setEditItem(null) }} />
      )}
    </>
  )
}
