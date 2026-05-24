'use client'

import { useState, useMemo, useTransition } from 'react'
import { ShoppingCart, LayoutGrid, List } from 'lucide-react'
import { deleteBudgetRequest, setRequestStatus, allocateRequestToPeriod } from '@/app/actions/requests'
import { formatCurrency, getPillColor, getPriorityColor } from '@/lib/utils'
import type { BudgetRequest, PriorityCategoryRecord } from '@/lib/types'
import RequestFormModal from './RequestFormModal'

interface Props {
  requests: BudgetRequest[]
  categories: PriorityCategoryRecord[]
  activePeriod: { id: string; period_name: string } | null
}

const STATUSES = ['requested', 'approved', 'purchased'] as const
type SortKey = 'priority' | 'amount' | 'recent'

export default function RequestsClient({ requests, categories, activePeriod }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<BudgetRequest | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [personFilter, setPersonFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('priority')
  const [groupByPerson, setGroupByPerson] = useState(false)
  const [view, setView] = useState<'card' | 'list'>('card')

  const categoryColorMap = useMemo(() => new Map(categories.map((c) => [c.name, c.color_key])), [categories])

  // Distinct people already used + static options — feed the form's For combobox.
  const people = useMemo(
    () => [...new Set(requests.map((r) => r.requested_for).filter(Boolean) as string[])].sort(),
    [requests]
  )
  const forWhoOptions = useMemo(() => [...new Set(['Home', 'Family', ...people])], [people])
  const tagOptions = useMemo(() => [...new Set(requests.flatMap((r) => r.tags ?? []))].sort(), [requests])

  const filtered = useMemo(() => {
    let list = [...requests]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.requested_for ?? '').toLowerCase().includes(q) ||
          (r.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    }
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter)
    if (personFilter !== 'all') list = list.filter((r) => (r.requested_for ?? '') === personFilter)
    list.sort((a, b) => {
      if (sortKey === 'amount') return b.amount - a.amount
      if (sortKey === 'recent') return (b.created_at ?? '').localeCompare(a.created_at ?? '')
      return (a.priority_category ?? 'Z').localeCompare(b.priority_category ?? 'Z')
    })
    return list
  }, [requests, search, statusFilter, personFilter, sortKey])

  const grouped = useMemo(() => {
    if (!groupByPerson) return null
    const map = new Map<string, BudgetRequest[]>()
    for (const r of filtered) {
      const key = r.requested_for || 'Unassigned'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered, groupByPerson])

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    startTransition(() => deleteBudgetRequest(id))
  }

  const cycleStatus = (req: BudgetRequest) => {
    const next = STATUSES[(STATUSES.indexOf(req.status as typeof STATUSES[number]) + 1) % STATUSES.length]
    startTransition(() => setRequestStatus(req.id, next))
  }

  const handleAllocate = (req: BudgetRequest) => {
    if (!activePeriod) return
    if (!confirm(`Add "${req.name}" to ${activePeriod.period_name}'s extra expenses?`)) return
    startTransition(() => allocateRequestToPeriod(req.id, activePeriod.id))
  }

  const statusColor = (s: string) =>
    s === 'purchased' ? 'bg-pill-green text-text-heading'
    : s === 'approved' ? 'bg-pill-blue text-text-heading'
    : 'bg-pill-yellow text-text-heading'

  const card = (req: BudgetRequest) => (
    <div key={req.id} className="bg-bg-white rounded-lg shadow-card overflow-hidden flex flex-col">
      {req.image_url && (
        <img src={req.image_url} alt="" className="w-full h-40 object-cover" />
      )}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-h3 font-semibold text-text-heading line-clamp-2">{req.name}</h3>
          {req.priority_category && (
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getPriorityColor(categoryColorMap.get(req.priority_category))}`}>
              {req.priority_category}
            </span>
          )}
        </div>

        <div className="flex-1">
          {req.amount > 0 && <div className="text-h3 font-bold text-text-heading mb-2">{formatCurrency(req.amount)}</div>}
          {req.requested_for && (
            <div className="text-caption text-text-muted mb-2">for <span className="font-semibold text-text-heading">{req.requested_for}</span></div>
          )}
          {req.url && (
            <a href={req.url} target="_blank" rel="noopener noreferrer" className="inline-block text-caption text-primary font-semibold hover:underline mb-2">View item ↗</a>
          )}
          {req.tags && req.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {req.tags.map((tag) => (
                <span key={tag} className={`px-2.5 py-0.5 rounded-full text-caption font-medium ${getPillColor(tag)}`}>{tag}</span>
              ))}
            </div>
          )}
          {req.notes && <p className="text-caption text-text-muted italic line-clamp-2">{req.notes}</p>}
        </div>

        {activePeriod && req.status !== 'purchased' && (
          <button
            onClick={() => handleAllocate(req)}
            disabled={isPending}
            className="mt-3 w-full bg-primary-teal/10 text-primary rounded-full px-4 py-1.5 text-caption font-bold hover:bg-primary-teal/20 disabled:opacity-50 transition-colors"
          >
            + Add to {activePeriod.period_name}
          </button>
        )}

        <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
          <div className="flex gap-3">
            <button onClick={() => { setEditItem(req); setModalOpen(true) }} className="text-caption text-primary font-semibold hover:underline">Edit</button>
            <button onClick={() => handleDelete(req.id, req.name)} disabled={isPending} className="text-caption text-text-muted hover:text-warning font-semibold transition-colors">Delete</button>
          </div>
          <button onClick={() => cycleStatus(req)} disabled={isPending} title="Click to change status" className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor(req.status)}`}>
            {req.status}
          </button>
        </div>
      </div>
    </div>
  )

  const row = (req: BudgetRequest) => (
    <div key={req.id} className="flex items-center gap-3 px-4 py-3 odd:bg-bg-white even:bg-[#ebf0f0] hover:bg-[#f2e9e9] transition-colors">
      {req.image_url
        ? <img src={req.image_url} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
        : <div className="w-12 h-12 rounded bg-surface-gray shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-caption font-semibold text-text-heading truncate">{req.name}</span>
          {req.priority_category && (
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getPriorityColor(categoryColorMap.get(req.priority_category))}`}>{req.priority_category}</span>
          )}
        </div>
        <div className="text-[11px] text-text-muted truncate">
          {req.requested_for && <span>for <span className="font-semibold text-text-heading">{req.requested_for}</span></span>}
          {req.requested_for && (req.tags?.length || req.url) ? ' · ' : ''}
          {req.tags?.join(', ')}
          {req.url && <a href={req.url} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline ml-1">↗</a>}
        </div>
      </div>
      <div className="w-20 text-right shrink-0 text-caption font-bold text-text-heading">{req.amount > 0 ? formatCurrency(req.amount) : ''}</div>
      <button onClick={() => cycleStatus(req)} disabled={isPending} title="Change status" className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor(req.status)}`}>{req.status}</button>
      {activePeriod && req.status !== 'purchased' && (
        <button onClick={() => handleAllocate(req)} disabled={isPending} title={`Add to ${activePeriod.period_name}`} className="shrink-0 bg-primary-teal/10 text-primary rounded-full px-3 py-1 text-caption font-bold hover:bg-primary-teal/20 disabled:opacity-50 transition-colors">+ Add</button>
      )}
      <button onClick={() => { setEditItem(req); setModalOpen(true) }} className="shrink-0 text-caption text-primary font-semibold hover:underline">Edit</button>
      <button onClick={() => handleDelete(req.id, req.name)} disabled={isPending} className="shrink-0 text-caption text-text-muted hover:text-warning font-semibold transition-colors">Delete</button>
    </div>
  )

  const renderItems = (items: BudgetRequest[]) =>
    view === 'list' ? (
      <div className="bg-bg-white rounded-lg shadow-card overflow-hidden">
        <div className="overflow-x-auto"><div className="min-w-[520px]">{items.map(row)}</div></div>
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{items.map(card)}</div>
    )

  const selectClass = 'bg-bg-white border border-border rounded-full px-3 py-1.5 text-caption focus:outline-none focus:border-primary transition-colors'

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => { setEditItem(null); setModalOpen(true) }}
          className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-label font-bold hover:opacity-90 transition-opacity"
        >
          + Add to List
        </button>
        <input
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[140px] bg-bg-white border border-border rounded-full px-4 py-2 text-caption focus:outline-none focus:border-primary transition-colors"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {people.length > 0 && (
          <select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} className={selectClass}>
            <option value="all">Everyone</option>
            {people.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={selectClass}>
          <option value="priority">Sort: Priority</option>
          <option value="amount">Sort: Amount</option>
          <option value="recent">Sort: Recent</option>
        </select>
        <button
          onClick={() => setGroupByPerson((g) => !g)}
          className={`rounded-full px-3 py-1.5 text-caption font-semibold border transition-colors ${groupByPerson ? 'bg-text-heading text-white border-text-heading' : 'bg-bg-white text-text-muted border-border hover:border-primary'}`}
        >
          Group by person
        </button>
        <div className="flex rounded-full border border-border overflow-hidden">
          <button onClick={() => setView('card')} title="Card view" className={`px-2.5 py-1.5 transition-colors ${view === 'card' ? 'bg-text-heading text-white' : 'bg-bg-white text-text-muted hover:text-text-heading'}`}>
            <LayoutGrid size={15} />
          </button>
          <button onClick={() => setView('list')} title="List view" className={`px-2.5 py-1.5 transition-colors ${view === 'list' ? 'bg-text-heading text-white' : 'bg-bg-white text-text-muted hover:text-text-heading'}`}>
            <List size={15} />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted gap-3">
          <ShoppingCart size={40} className="opacity-30" />
          <p className="text-body">{requests.length === 0 ? 'No next buys yet — add something to your list!' : 'Nothing matches your filters.'}</p>
        </div>
      ) : grouped ? (
        <div className="space-y-8">
          {grouped.map(([person, items]) => (
            <div key={person}>
              <h2 className="text-h3 font-bold text-text-heading mb-3">{person} <span className="text-caption font-medium text-text-muted">({items.length})</span></h2>
              {renderItems(items)}
            </div>
          ))}
        </div>
      ) : (
        renderItems(filtered)
      )}

      {modalOpen && (
        <RequestFormModal
          editItem={editItem}
          onClose={() => { setModalOpen(false); setEditItem(null) }}
          categories={categories}
          forWhoOptions={forWhoOptions}
          tagOptions={tagOptions}
        />
      )}
    </>
  )
}
