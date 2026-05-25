'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { deleteBudgetPeriod, completePeriod, reopenPeriod } from '@/app/actions/periods'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BudgetPeriod } from '@/lib/types'
import CreatePeriodModal from './CreatePeriodModal'
import EditPeriodModal from './EditPeriodModal'

/** Strip legacy " - Period" suffix from old period names */
function displayName(name: string) {
  return name.replace(/ - Period$/i, '')
}

export default function PeriodsClient({ periods }: { periods: BudgetPeriod[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editPeriod, setEditPeriod] = useState<BudgetPeriod | null>(null)

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete budget "${displayName(name)}"? This will remove all expenses in this budget.`)) return
    startTransition(() => deleteBudgetPeriod(id))
  }

  const handleToggleComplete = (period: BudgetPeriod) => {
    startTransition(() => (period.status === 'complete' ? reopenPeriod(period.id) : completePeriod(period.id)))
  }

  return (
    <>
      <div className="flex mb-6">
        <button
          onClick={() => setModalOpen(true)}
          className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 transition-opacity"
        >
          + New Budget
        </button>
      </div>

      {periods.length === 0 ? (
        <div className="bg-bg-white rounded-lg shadow-card p-12 text-center">
          <CalendarDays size={48} strokeWidth={1.5} className="text-text-muted mx-auto mb-4" />
          <p className="font-bold text-text-heading text-h3 mb-1">No budgets yet</p>
          <p className="text-caption text-text-muted">Create your first budget to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...periods].reverse().map((period) => (
            <div
              key={period.id}
              onClick={() => router.push(`/periods/${period.id}`)}
              className={`rounded-lg shadow-card p-6 hover:shadow-lg transition-shadow cursor-pointer ${
                period.status === 'complete' ? 'bg-surface-beige opacity-80' : 'bg-bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="font-bold text-text-heading text-h3">
                  {displayName(period.period_name)}
                </h3>
                {period.status === 'complete' ? (
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-success/10 text-success px-2 py-0.5 rounded-full">🔒 Complete</span>
                ) : (
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-primary-teal/10 text-primary-teal px-2 py-0.5 rounded-full">Active</span>
                )}
              </div>
              <div className="space-y-1 mb-3">
                <div className="flex justify-between text-caption">
                  <span className="text-text-muted">Income</span>
                  <span className="font-bold text-text-heading">
                    {formatCurrency(period.income_amount)}
                  </span>
                </div>
              </div>
              <div className="text-caption text-text-muted">
                Created {formatDate(period.created_at)}
              </div>
              <div className="flex flex-wrap gap-3 pt-3 mt-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/periods/${period.id}`)
                  }}
                  className="text-caption text-primary-teal font-semibold hover:underline"
                >
                  Open
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditPeriod(period)
                  }}
                  className="text-caption text-primary font-semibold hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleComplete(period)
                  }}
                  disabled={isPending}
                  className="text-caption text-text-muted hover:text-success font-semibold transition-colors disabled:opacity-50"
                >
                  {period.status === 'complete' ? 'Reopen' : 'Mark complete'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(period.id, period.period_name)
                  }}
                  disabled={isPending}
                  className="text-caption text-text-muted hover:text-warning font-semibold transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && <CreatePeriodModal onClose={() => setModalOpen(false)} />}
      {editPeriod && <EditPeriodModal period={editPeriod} onClose={() => setEditPeriod(null)} />}
    </>
  )
}
