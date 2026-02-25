'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteBudgetPeriod } from '@/app/actions/periods'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BudgetPeriod } from '@/lib/types'
import CreatePeriodModal from './CreatePeriodModal'

export default function PeriodsClient({ periods }: { periods: BudgetPeriod[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete period "${name}"? This will remove all expenses in this period.`)) return
    startTransition(() => deleteBudgetPeriod(id))
  }

  return (
    <>
      <div className="flex mb-6">
        <button
          onClick={() => setModalOpen(true)}
          className="bg-blue text-white rounded-[12px] px-5 py-2.5 font-bold hover:opacity-90 text-sm"
        >
          + New Period
        </button>
      </div>

      {periods.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <div className="text-4xl mb-4 opacity-50">📅</div>
          <p>No budget periods yet</p>
          <p className="text-xs mt-1">Create your first period to start budgeting</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...periods].reverse().map((period) => (
            <div
              key={period.id}
              onClick={() => router.push(`/periods/${period.id}`)}
              className="bg-white border border-line rounded-[20px] p-6 hover:border-blue transition-colors cursor-pointer"
            >
              <h3 className="font-bold text-ink text-lg mb-2">{period.period_name}</h3>
              <div className="space-y-1 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Income</span>
                  <span className="font-bold text-ink">{formatCurrency(period.income_amount)}</span>
                </div>
              </div>
              <div className="text-xs text-muted">
                Created {formatDate(period.created_at)}
              </div>
              <div className="flex gap-2 pt-3 mt-3 border-t border-line">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/periods/${period.id}`)
                  }}
                  className="text-xs text-blue font-bold hover:underline"
                >
                  Open
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(period.id, period.period_name)
                  }}
                  disabled={isPending}
                  className="text-xs text-orange font-bold hover:underline"
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
