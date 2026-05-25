'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { quickAddRequest, allocateRequestToPeriod } from '@/app/actions/requests'
import { formatCurrency } from '@/lib/utils'
import RequestFormModal from '@/components/requests/RequestFormModal'
import type { BudgetRequest, RequestStatus, PriorityCategoryRecord } from '@/lib/types'

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
  const [showDone, setShowDone] = useState(false) // "Got it" items hidden by default
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [editing, setEditing] = useState<BudgetRequest | null>(null)

  const doneCount = requests.filter((r) => r.status === 'obtained').length
  const visible = showDone ? requests : requests.filter((r) => r.status !== 'obtained')

  // Suggestion options for the edit form, derived from existing requests
  const forWhoOptions = [...new Set(['Home', 'Family', 'Guests', 'Giving', ...requests.map((r) => r.requested_for).filter((x): x is string => !!x)])]
  const tagOptions = [...new Set(requests.flatMap((r) => r.tags ?? []))]

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

          {requests.length === 0 ? (
            <p className="text-caption text-text-muted">No requests yet. Add one above — it lands on your wish list.</p>
          ) : visible.length === 0 ? (
            <p className="text-caption text-text-muted">All caught up — nothing left on the list.</p>
          ) : (
            <div className="divide-y divide-[#e9e9e9]">
              {visible.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        title="Edit request details"
                        className="text-caption font-medium text-text-heading truncate text-left hover:text-primary hover:underline transition-colors"
                      >
                        {r.name}
                      </button>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_PILL[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.requested_for && (
                        <span className="text-[10px] text-text-muted">for {r.requested_for}</span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-caption font-bold text-text-heading">{formatCurrency(r.amount)}</span>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => allocate(r.id)}
                      disabled={isPending}
                      title="Add to this budget as an extra expense"
                      className="shrink-0 text-caption font-semibold text-primary hover:underline disabled:opacity-50"
                    >
                      + Add to budget
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {doneCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              title={showDone ? 'Hide items you already got' : 'Show items you already got'}
              className="mt-3 inline-flex items-center gap-1.5 text-caption text-text-muted hover:text-primary font-semibold transition-colors"
            >
              <span aria-hidden>👁</span>
              {showDone ? 'Hide completed' : `Show completed (${doneCount})`}
            </button>
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
