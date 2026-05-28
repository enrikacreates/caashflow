'use client'

import { useMemo, useState, useTransition } from 'react'
import { Hammer, Trophy, ChevronDown, ChevronRight, SlidersHorizontal, LayoutGrid, List } from 'lucide-react'
import DebtCard from './DebtCard'
import DebtModal from './DebtModal'
import { formatCurrency } from '@/lib/utils'
import { deleteDebt } from '@/app/actions/debts'
import type { Debt, BaseBudgetItem } from '@/lib/types'

// ─── Sort keys for the list/card views ──────────────────────────────
type SortKey = 'balance-desc' | 'balance-asc' | 'interest-desc' | 'min-desc' | 'payoff-soonest' | 'name'

// Mirror of the payoff-date math in DebtCard, so we can sort by it here.
function payoffMonths(d: Debt): number | null {
  if (!d.minimum_payment || d.minimum_payment <= 0 || d.current_balance <= 0) return null
  const r = d.interest_rate ? d.interest_rate / 100 / 12 : 0
  let months: number
  if (r > 0) {
    const ratio = (r * d.current_balance) / d.minimum_payment
    if (ratio >= 1) return null
    months = -Math.log(1 - ratio) / Math.log(1 + r)
  } else {
    months = d.current_balance / d.minimum_payment
  }
  if (!isFinite(months) || months > 1200) return null
  return months
}

function payoffLabel(months: number): string {
  if (months <= 0) return 'this mo'
  if (months < 12) return `${Math.round(months)} mo`
  const y = Math.floor(months / 12)
  const m = Math.round(months % 12)
  return m === 0 ? `${y}y` : `${y}y ${m}m`
}

export default function DebtsClient({
  debts,
  budgetItems,
}: {
  debts: Debt[]
  budgetItems: BaseBudgetItem[]
}) {
  const [showModal, setShowModal] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | undefined>(undefined)
  const [showPaidOff, setShowPaidOff] = useState(false)
  const [view, setView] = useState<'card' | 'list'>('card')
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('balance-desc')
  const [isPending, startTransition] = useTransition()

  const activeDebts = debts.filter((d) => !d.is_paid_off)
  const paidOffDebts = debts.filter((d) => d.is_paid_off)

  const totalRemaining = activeDebts.reduce((sum, d) => sum + d.current_balance, 0)
  const totalOriginal = activeDebts.reduce((sum, d) => sum + d.original_balance, 0)
  const totalPaid = totalOriginal - totalRemaining
  const overallProgress = totalOriginal > 0 ? (totalPaid / totalOriginal) * 100 : 0

  // ─── Search + sort applied to active debts (paid-off list stays as-is) ───
  const filtered = useMemo(() => {
    let list = [...activeDebts]
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((d) =>
        d.name.toLowerCase().includes(q) || (d.notes ?? '').toLowerCase().includes(q),
      )
    }
    list.sort((a, b) => {
      switch (sortKey) {
        case 'balance-desc': return b.current_balance - a.current_balance
        case 'balance-asc':  return a.current_balance - b.current_balance
        case 'interest-desc': return (b.interest_rate ?? -1) - (a.interest_rate ?? -1)
        case 'min-desc':     return (b.minimum_payment ?? 0) - (a.minimum_payment ?? 0)
        case 'payoff-soonest': {
          const am = payoffMonths(a) ?? Infinity
          const bm = payoffMonths(b) ?? Infinity
          return am - bm
        }
        case 'name': return a.name.localeCompare(b.name)
      }
    })
    return list
  }, [activeDebts, search, sortKey])

  const handleEdit = (debt: Debt) => {
    setEditingDebt(debt)
    setShowModal(true)
  }

  const handleClose = () => {
    setShowModal(false)
    setEditingDebt(undefined)
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    startTransition(() => deleteDebt(id))
  }

  const selectClass = 'bg-bg-white border border-border rounded-full px-3 py-1.5 text-caption text-text-heading focus:outline-none focus:border-primary transition-colors'

  // ─── Compact list row — single horizontal line per debt ────────────
  const listRow = (d: Debt) => {
    const progress = d.original_balance > 0
      ? Math.min(100, ((d.original_balance - d.current_balance) / d.original_balance) * 100)
      : 100
    const months = payoffMonths(d)
    return (
      <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#f2e9e9] transition-colors">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => handleEdit(d)}
            title="Click to edit"
            className="text-caption font-semibold text-text-heading underline decoration-dotted decoration-text-muted underline-offset-4 hover:text-primary hover:decoration-solid hover:decoration-primary transition-colors text-left cursor-pointer truncate block"
          >
            {d.name}
          </button>
          <div className="text-[11px] text-text-muted">
            {d.interest_rate != null && <span>{d.interest_rate}% APR</span>}
            {d.interest_rate != null && d.due_day ? ' · ' : ''}
            {d.due_day ? <span>Due day {d.due_day}</span> : null}
          </div>
        </div>
        <div className="w-32 text-right shrink-0">
          <div className="text-caption font-bold text-text-heading">{formatCurrency(d.current_balance)}</div>
          <div className="text-[11px] text-text-muted">of {formatCurrency(d.original_balance)}</div>
        </div>
        <div className="w-20 text-right shrink-0 text-caption font-semibold text-success">
          {Math.round(progress)}%
        </div>
        <div className="w-24 text-right shrink-0 text-caption text-text-muted">
          {d.minimum_payment ? <>{formatCurrency(d.minimum_payment)}<span className="text-[11px]">/mo</span></> : '—'}
        </div>
        <div className="w-20 text-right shrink-0 text-caption text-text-muted">
          {months != null ? payoffLabel(months) : '—'}
        </div>
        <div className="w-32 shrink-0 flex justify-end gap-2 whitespace-nowrap">
          <button onClick={() => handleEdit(d)} className="text-caption text-primary font-semibold hover:underline">Edit</button>
          <button onClick={() => handleDelete(d.id, d.name)} disabled={isPending} className="text-caption text-text-muted hover:text-warning font-semibold transition-colors">Delete</button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Summary */}
      {activeDebts.length > 0 && (
        <div className="bg-bg-white rounded-lg shadow-card p-6">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-caption font-semibold text-text-muted uppercase tracking-wide mb-1">
                Total Remaining
              </p>
              <p className="text-h1 font-bold text-text-heading">{formatCurrency(totalRemaining)}</p>
              <p className="text-caption text-text-muted mt-1">
                across {activeDebts.length} debt{activeDebts.length !== 1 ? 's' : ''}
                {totalOriginal > 0 && ` · ${Math.round(overallProgress)}% paid overall`}
              </p>
            </div>
            <button
              onClick={() => { setEditingDebt(undefined); setShowModal(true) }}
              className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 transition-opacity"
            >
              + Add Debt
            </button>
          </div>

          {totalOriginal > 0 && (
            <div className="w-full bg-surface-gray rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full bg-primary-teal transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Filters / view-toggle bar — same pattern as the Requests page */}
      {activeDebts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowFilters((v) => !v)}
            title="Filters & sorting"
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-caption font-semibold border transition-colors ${showFilters ? 'bg-text-heading text-white border-text-heading' : 'bg-bg-white text-text-muted border-border hover:border-primary'}`}
          >
            <SlidersHorizontal size={15} />
            Filters
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
      )}

      {showFilters && activeDebts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search debts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[160px] bg-bg-white border border-border rounded-full px-4 py-2 text-caption focus:outline-none focus:border-primary transition-colors"
          />
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={selectClass}>
            <option value="balance-desc">Sort: Balance (highest)</option>
            <option value="balance-asc">Sort: Balance (lowest — snowball)</option>
            <option value="interest-desc">Sort: Interest rate (highest — avalanche)</option>
            <option value="min-desc">Sort: Min payment (highest)</option>
            <option value="payoff-soonest">Sort: Payoff (soonest)</option>
            <option value="name">Sort: Name (A–Z)</option>
          </select>
        </div>
      )}

      {/* Empty state */}
      {debts.length === 0 && (
        <div className="bg-bg-white rounded-lg shadow-card p-12 text-center">
          <Hammer size={48} strokeWidth={1.5} className="text-text-muted mx-auto mb-4" />
          <p className="font-bold text-text-heading text-h3 mb-1">No debts tracked yet</p>
          <p className="text-caption text-text-muted mb-6">Add your first debt to start tracking progress</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary-teal text-text-inverse rounded-full px-6 py-3 text-caption font-semibold hover:opacity-90 transition-opacity"
          >
            + Add First Debt
          </button>
        </div>
      )}

      {/* No matches under current filter */}
      {activeDebts.length > 0 && filtered.length === 0 && (
        <div className="bg-bg-white rounded-lg shadow-card p-8 text-center">
          <p className="text-caption text-text-muted">Nothing matches your search.</p>
        </div>
      )}

      {/* Active debts — card OR list view */}
      {filtered.length > 0 && view === 'card' && (
        <div className="space-y-4">
          {filtered.map((debt) => (
            <DebtCard key={debt.id} debt={debt} onEdit={handleEdit} />
          ))}
        </div>
      )}
      {filtered.length > 0 && view === 'list' && (
        <div className="bg-bg-white rounded-lg shadow-card overflow-hidden divide-y divide-divider">
          {/* Column headers */}
          <div className="flex items-center gap-3 px-4 py-2 bg-surface-beige text-[10px] font-bold uppercase text-text-muted tracking-wide">
            <div className="flex-1 min-w-0">Name</div>
            <div className="w-32 text-right shrink-0">Balance</div>
            <div className="w-20 text-right shrink-0">Paid</div>
            <div className="w-24 text-right shrink-0">Min/mo</div>
            <div className="w-20 text-right shrink-0">Payoff</div>
            <div className="w-32 shrink-0" />
          </div>
          {filtered.map(listRow)}
        </div>
      )}

      {/* Add button when no summary (only paid off or mix) */}
      {activeDebts.length === 0 && debts.length > 0 && (
        <button
          onClick={() => { setEditingDebt(undefined); setShowModal(true) }}
          className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 transition-opacity"
        >
          + Add Debt
        </button>
      )}

      {/* Paid off section */}
      {paidOffDebts.length > 0 && (
        <div>
          <button
            onClick={() => setShowPaidOff((v) => !v)}
            className="text-caption font-semibold text-text-muted hover:text-text-heading transition-colors flex items-center gap-2"
          >
            {showPaidOff ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {paidOffDebts.length} Paid Off
            <Trophy size={14} className="text-warning" />
          </button>
          {showPaidOff && (
            <div className="space-y-2 mt-3">
              {paidOffDebts.map((debt) => (
                <DebtCard key={debt.id} debt={debt} onEdit={handleEdit} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <DebtModal debt={editingDebt} budgetItems={budgetItems} onClose={handleClose} />
      )}
    </>
  )
}
