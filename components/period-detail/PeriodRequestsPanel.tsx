'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { quickAddRequest, allocateRequestToPeriod } from '@/app/actions/requests'
import { formatCurrency, getPriorityColor } from '@/lib/utils'
import RequestFormModal from '@/components/requests/RequestFormModal'
import type { BudgetRequest, RequestStatus, PriorityCategoryRecord } from '@/lib/types'

type PanelSortKey = 'priority' | 'amount' | 'recent' | 'name' | 'status'
const defaultDir = (key: PanelSortKey): 'asc' | 'desc' => (key === 'amount' || key === 'recent' ? 'desc' : 'asc')

/** Compact a priority category name down to just its "P7"-style code. */
function priorityCode(name: string): string {
  const m = name.match(/p\s*\d+/i)
  return (m ? m[0] : name.split(':')[0]).replace(/\s+/g, '').toUpperCase().slice(0, 3)
}

const STATUS_LABEL: Record<RequestStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  purchased: 'Purchased',
  obtained: 'Got it',
}
const STATUS_PILL: Record<RequestStatus, string> = {
  requested: 'bg-surface-beige text-text-muted',
  approved: 'bg-primary-teal/10 text-primary',
  purchased: 'bg-primary-teal/10 text-primary',
  obtained: 'bg-success/10 text-success',
}

export default function PeriodRequestsPanel({
  requests, periodId, isLocked, categories,
}: { requests: BudgetRequest[]; periodId: string; isLocked: boolean; categories: PriorityCategoryRecord[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false) // default collapsed
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [editing, setEditing] = useState<BudgetRequest | null>(null)

  // Filters mirror the Requests page; status defaults to "active" (hides Got it)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [personFilter, setPersonFilter] = useState('all')
  const [sortKey, setSortKey] = useState<PanelSortKey>('priority')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const people = [...new Set(requests.map((r) => r.requested_for).filter((x): x is string => !!x))].sort()
  const categoryColorMap = new Map(categories.map((c) => [c.name, c.color_key]))
  const chooseSort = (key: PanelSortKey) => { setSortKey(key); setSortDir(defaultDir(key)) }
  const handleSort = (key: PanelSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else chooseSort(key)
  }
  const SortIcon = ({ col }: { col: PanelSortKey }) => (
    <span className="ml-1 text-[10px] opacity-50">{sortKey === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
  )

  const visible = (() => {
    const q = search.trim().toLowerCase()
    let list = [...requests]
    if (q) list = list.filter((r) => `${r.name} ${r.requested_for ?? ''} ${r.notes ?? ''}`.toLowerCase().includes(q))
    if (statusFilter === 'active') list = list.filter((r) => r.status !== 'obtained')
    else if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter)
    if (personFilter !== 'all') list = list.filter((r) => (r.requested_for ?? '') === personFilter)
    const mul = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortKey === 'amount') return (a.amount - b.amount) * mul
      if (sortKey === 'recent') return (a.created_at ?? '').localeCompare(b.created_at ?? '') * mul
      if (sortKey === 'name') return a.name.localeCompare(b.name) * mul
      if (sortKey === 'status') return a.status.localeCompare(b.status) * mul
      return (a.priority_category ?? 'Z').localeCompare(b.priority_category ?? 'Z') * mul
    })
    return list
  })()

  // Suggestion options for the edit form, derived from existing requests
  const forWhoOptions = [...new Set(['Home', 'Family', 'Guests', 'Giving', ...people])]
  const tagOptions = [...new Set(requests.flatMap((r) => r.tags ?? []))]
  const selectClass = 'bg-bg-white border border-border rounded-full px-3 py-1.5 text-caption focus:outline-none focus:border-primary transition-colors'

  const add = () => {
    const n = name.trim()
    if (!n) return
    const amt = parseFloat(amount) || 0
    startTransition(async () => {
      await quickAddRequest(n, null, amt)
      setName('')
      setAmount('')
      router.refresh()
    })
  }

  const allocate = (id: string) =>
    startTransition(async () => {
      await allocateRequestToPeriod(id, periodId)
      router.refresh()
    })

  return (
    <div className="bg-bg-white rounded-lg shadow-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h3 font-bold text-text-heading">
          <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-2 hover:text-primary transition-colors">
            <span className="text-text-muted text-base leading-none">{open ? '▾' : '▸'}</span>
            Requests
          </button>
          <span className="text-caption font-medium text-text-muted ml-2">({visible.length})</span>
        </h2>
        <span className="text-caption text-text-muted">Pull a wish-list item into this budget as an extra expense.</span>
      </div>

      {open && (
        <div className="mt-4">
          {!isLocked && (
            <div className="flex flex-wrap gap-2 items-end bg-surface-beige rounded-sm p-4 mb-4">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-caption font-bold text-text-muted mb-1">Add a request</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
                  placeholder="e.g., New office chair"
                  className="w-full bg-bg-white border border-border rounded-sm px-3 py-1.5 text-caption focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="w-28">
                <label className="block text-caption font-bold text-text-muted mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
                  placeholder="0.00"
                  className="w-full bg-bg-white border border-border rounded-sm px-3 py-1.5 text-caption focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={add}
                disabled={isPending || !name.trim()}
                className="bg-primary-teal text-text-inverse rounded-full px-4 py-1.5 text-caption font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Add
              </button>
            </div>
          )}

          {requests.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              <input
                type="search"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[120px] bg-bg-white border border-border rounded-full px-3 py-1.5 text-caption focus:outline-none focus:border-primary transition-colors"
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
                <option value="active">Active</option>
                <option value="all">All statuses</option>
                <option value="requested">Requested</option>
                <option value="approved">Approved</option>
                <option value="purchased">Purchased</option>
                <option value="obtained">Got it</option>
              </select>
              {people.length > 0 && (
                <select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} className={selectClass}>
                  <option value="all">Everyone</option>
                  {people.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              <select value={sortKey} onChange={(e) => chooseSort(e.target.value as PanelSortKey)} className={selectClass}>
                <option value="priority">Sort: Priority</option>
                <option value="amount">Sort: Amount</option>
                <option value="recent">Sort: Recent</option>
                <option value="name">Sort: Name</option>
                <option value="status">Sort: Status</option>
              </select>
            </div>
          )}

          {requests.length === 0 ? (
            <p className="text-caption text-text-muted">No requests yet. Add one above — it lands on your wish list.</p>
          ) : visible.length === 0 ? (
            <p className="text-caption text-text-muted">Nothing matches your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Sortable table header */}
                <div className="flex items-center gap-3 px-3 py-2 bg-surface-beige/40 select-none text-caption font-bold uppercase text-text-muted">
                  <button onClick={() => handleSort('name')} className="flex-1 min-w-0 text-left hover:text-text-heading transition-colors">Item<SortIcon col="name" /></button>
                  <button onClick={() => handleSort('priority')} className="w-12 shrink-0 text-center hover:text-text-heading transition-colors">Pri<SortIcon col="priority" /></button>
                  <button onClick={() => handleSort('amount')} className="w-24 shrink-0 text-right hover:text-text-heading transition-colors">Amount<SortIcon col="amount" /></button>
                  <button onClick={() => handleSort('status')} className="w-24 shrink-0 text-center hover:text-text-heading transition-colors">Status<SortIcon col="status" /></button>
                  <div className="w-32 shrink-0" />
                </div>
                <div className="divide-y divide-[#e9e9e9]">
                  {visible.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => setEditing(r)}
                          title="Edit request details"
                          className="block max-w-full text-caption font-medium text-text-heading truncate text-left hover:text-primary hover:underline transition-colors"
                        >
                          {r.name}
                        </button>
                        {r.requested_for && <div className="text-[10px] text-text-muted truncate">for {r.requested_for}</div>}
                      </div>
                      <div className="w-12 shrink-0 flex justify-center">
                        {r.priority_category && (
                          <span title={r.priority_category} className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getPriorityColor(categoryColorMap.get(r.priority_category))}`}>{priorityCode(r.priority_category)}</span>
                        )}
                      </div>
                      <div className="w-24 shrink-0 text-right text-caption font-bold text-text-heading">{formatCurrency(r.amount)}</div>
                      <div className="w-24 shrink-0 flex justify-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_PILL[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                      </div>
                      <div className="w-32 shrink-0 text-right">
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => allocate(r.id)}
                            disabled={isPending}
                            title="Add to this budget as an extra expense"
                            className="text-caption font-semibold text-primary hover:underline disabled:opacity-50"
                          >
                            + Add to budget
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {editing && (
        <RequestFormModal
          editItem={editing}
          categories={categories}
          forWhoOptions={forWhoOptions}
          tagOptions={tagOptions}
          onClose={() => { setEditing(null); router.refresh() }}
        />
      )}
    </div>
  )
}
