'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { deleteBudgetPeriod } from '@/app/actions/periods'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BudgetPeriod } from '@/lib/types'
import CreatePeriodModal from './CreatePeriodModal'

/** Strip legacy " - Period" suffix from old period names */
function displayName(name: string) {
  return name.replace(/ - Period$/i, '')
}

export default function PeriodsClient({ periods }: { periods: BudgetPeriod[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete budget "${displayName(name)}"? This will remove all expenses in this budget.`)) return
    startTransition(() => deleteBudgetPeriod(id))
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
              className="bg-bg-white rounded-lg shadow-card p-6 hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="font-bold text-text-heading text-h3 mb-2">
                {displayName(period.period_name)}
              </h3>
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
              <div className="flex gap-3 pt-3 mt-3">
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
    </>
  )
}
