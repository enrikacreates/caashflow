'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, LayoutGrid, List } from 'lucide-react'
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
  const [view, setView] = useState<'card' | 'list'>('card')

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete budget "${displayName(name)}"? This will remove all expenses in this budget.`)) return
    startTransition(() => deleteBudgetPeriod(id))
  }

  const handleToggleComplete = (period: BudgetPeriod) => {
    startTransition(() => (period.status === 'complete' ? reopenPeriod(period.id) : completePeriod(period.id)))
  }

  const renderActions = (period: BudgetPeriod) => (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); router.push(`/periods/${period.id}`) }}
        className="text-caption text-primary-teal font-semibold hover:underline"
      >
        Open
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setEditPeriod(period) }}
        className="text-caption text-primary font-semibold hover:underline"
      >
        Edit
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleToggleComplete(period) }}
        disabled={isPending}
        className="text-caption text-text-muted hover:text-success font-semibold transition-colors disabled:opacity-50"
      >
        {period.status === 'complete' ? 'Reopen' : 'Mark complete'}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleDelete(period.id, period.period_name) }}
        disabled={isPending}
        className="text-caption text-text-muted hover:text-warning font-semibold transition-colors"
      >
        Delete
      </button>
    </>
  )

  const statusPill = (period: BudgetPeriod) =>
    period.status === 'complete' ? (
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-success/10 text-success px-2 py-0.5 rounded-full">🔒 Complete</span>
    ) : (
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-primary-teal/10 text-primary-teal px-2 py-0.5 rounded-full">Active</span>
    )

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-6">
        <button
          onClick={() => setModalOpen(true)}
          className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 transition-opacity"
        >
          + New Budget
        </button>
        {periods.length > 0 && (
          <div className="flex rounded-full border border-border overflow-hidden">
            <button onClick={() => setView('card')} title="Card view" className={`px-2.5 py-1.5 transition-colors ${view === 'card' ? 'bg-text-heading text-white' : 'bg-bg-white text-text-muted hover:text-text-heading'}`}>
              <LayoutGrid size={15} />
            </button>
            <button onClick={() => setView('list')} title="List view" className={`px-2.5 py-1.5 transition-colors ${view === 'list' ? 'bg-text-heading text-white' : 'bg-bg-white text-text-muted hover:text-text-heading'}`}>
              <List size={15} />
            </button>
          </div>
        )}
      </div>

      {periods.length === 0 ? (
        <div className="bg-bg-white rounded-lg shadow-card p-12 text-center">
          <CalendarDays size={48} strokeWidth={1.5} className="text-text-muted mx-auto mb-4" />
          <p className="font-bold text-text-heading text-h3 mb-1">No budgets yet</p>
          <p className="text-caption text-text-muted">Create your first budget to get started</p>
        </div>
      ) : (
        (() => {
          // Split into Monthly + Event sections. Events render together below the monthlies.
          const monthlies = [...periods].filter((p) => (p.kind ?? 'monthly') !== 'event').reverse()
          const events = [...periods].filter((p) => p.kind === 'event').reverse()

          const SectionHeading = ({ label, hint, count }: { label: string; hint: string; count: number }) =>
            count === 0 ? null : (
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className="text-h3 font-bold text-text-heading">{label}</h2>
                <span className="text-caption text-text-muted">{hint}</span>
              </div>
            )

          const renderCard = (period: BudgetPeriod) => (
            <div
              key={period.id}
              onClick={() => router.push(`/periods/${period.id}`)}
              className={`rounded-lg shadow-card p-6 hover:shadow-lg transition-shadow cursor-pointer ${
                period.status === 'complete' ? 'bg-white/60' : 'bg-bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className={`font-bold text-h3 flex items-center gap-2 ${period.status === 'complete' ? 'text-text-muted' : 'text-text-heading'}`}>
                  {period.kind === 'event' && <span aria-hidden>✨</span>}
                  {displayName(period.period_name)}
                </h3>
                {statusPill(period)}
              </div>
              <div className="space-y-1 mb-3">
                <div className="flex justify-between text-caption">
                  <span className="text-text-muted">{period.kind === 'event' ? 'Contributions' : 'Income'}</span>
                  <span className={`font-bold ${period.status === 'complete' ? 'text-text-muted' : 'text-text-heading'}`}>{formatCurrency(period.income_amount)}</span>
                </div>
              </div>
              <div className="text-caption text-text-muted">Created {formatDate(period.created_at)}</div>
              <div className="flex flex-wrap gap-3 pt-3 mt-3">{renderActions(period)}</div>
            </div>
          )

          const renderRow = (period: BudgetPeriod) => (
            <div
              key={period.id}
              onClick={() => router.push(`/periods/${period.id}`)}
              className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-surface-beige transition-colors ${
                period.status === 'complete' ? 'bg-[#FFFCF9]' : ''
              }`}
            >
              <div className="flex flex-col items-start gap-1.5 flex-1 min-w-[130px]">
                <h3 className={`font-bold truncate max-w-full flex items-center gap-2 ${period.status === 'complete' ? 'text-text-muted' : 'text-text-heading'}`}>
                  {period.kind === 'event' && <span aria-hidden>✨</span>}
                  {displayName(period.period_name)}
                </h3>
                {statusPill(period)}
              </div>
              <div className="hidden sm:flex flex-1 flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{period.kind === 'event' ? 'Contributions' : 'Income'}</span>
                <span className={`text-caption font-bold ${period.status === 'complete' ? 'text-text-muted' : 'text-text-heading'}`}>{formatCurrency(period.income_amount)}</span>
              </div>
              <div className="hidden md:flex flex-1 flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Created</span>
                <span className="text-caption text-text-muted">{formatDate(period.created_at)}</span>
              </div>
              <div className="flex flex-wrap gap-3 justify-end shrink-0">{renderActions(period)}</div>
            </div>
          )

          const renderGroup = (label: string, hint: string, list: BudgetPeriod[]) => {
            if (list.length === 0) return null
            return (
              <section className="space-y-3">
                <SectionHeading label={label} hint={hint} count={list.length} />
                {view === 'card' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {list.map(renderCard)}
                  </div>
                ) : (
                  <div className="bg-bg-white rounded-lg shadow-card overflow-hidden divide-y divide-[#e9e9e9]">
                    {list.map(renderRow)}
                  </div>
                )}
              </section>
            )
          }

          return (
            <div className="space-y-8">
              {renderGroup('Monthly', 'Pay-period budgets', monthlies)}
              {renderGroup('Events ✨', 'Parties, trips, situational budgets', events)}
            </div>
          )
        })()
      )}

      {modalOpen && <CreatePeriodModal onClose={() => setModalOpen(false)} />}
      {editPeriod && <EditPeriodModal period={editPeriod} onClose={() => setEditPeriod(null)} />}
    </>
  )
}
