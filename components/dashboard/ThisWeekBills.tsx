'use client'

import { useOptimistic, useState, useSyncExternalStore } from 'react'
import { CalendarClock, ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { localToday } from '@/lib/sessions'
import { pastDueBillsByDay, upcomingBillsByDay } from '@/lib/upcoming'
import PeriodExpenseEditModal from '@/components/period-detail/PeriodExpenseEditModal'
import ExpenseFormModal from '@/components/base-budget/ExpenseFormModal'
import MarkPaidModal from '@/components/period-detail/MarkPaidModal'
import type { UpcomingBill, UpcomingBudget, UpcomingDay, UpcomingStatus } from '@/lib/upcoming'
import type { Account, BaseBudgetItem, BillPayment, PeriodExpense, PriorityCategoryRecord } from '@/lib/types'

const STATUS: Record<UpcomingStatus, { label: string; className: string }> = {
  unfunded: { label: 'Not funded', className: 'bg-warning/10 text-warning' },
  funded: { label: 'Funded', className: 'bg-pill-cyan-light text-primary' },
  paid: { label: 'Paid', className: 'bg-pill-peach/60 text-text-heading' },
  baseline: { label: 'No budget yet', className: 'bg-surface-beige text-text-muted' },
}

const noSubscribe = () => () => {}

function dayLabel(day: UpcomingDay): string {
  if (day.offset === 0) return 'Today'
  if (day.offset === 1) return 'Tomorrow'
  if (day.offset === -1) return 'Yesterday'
  const [y, m, d] = day.date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' })
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Worth asking "Paid?" when nothing on record says: a past-due auto-pay bill the budget
 * has no info on (it probably went out on its own), or a bill with no budget at all.
 */
function askIfPaid(bill: UpcomingBill, day: UpcomingDay): boolean {
  if (bill.status === 'baseline') return true
  return bill.autoPay && bill.status === 'unfunded' && day.offset < 0 && !bill.isSplitPart
}

function DayCards({ days, onEdit, onPaid }: {
  days: UpcomingDay[]
  onEdit: (bill: UpcomingBill) => void
  onPaid: (bill: UpcomingBill, date: string) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
      {days.map((day) => (
        <div key={day.date} className="bg-bg-white rounded-lg shadow-card p-4">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <div className="text-caption font-bold text-text-heading">
              {dayLabel(day)} <span className="font-medium text-text-muted">{shortDate(day.date)}</span>
            </div>
            <span className="text-caption font-bold text-text-heading">{formatCurrency(day.total)}</span>
          </div>
          <ul className="space-y-3">
            {day.bills.map((bill) => (
              <li key={bill.key}>
                <div className="relative flex items-center justify-between gap-3 group">
                    <button type="button" onClick={() => onEdit(bill)} aria-label={`Edit ${bill.name}`} title={`Edit ${bill.name}`} className="absolute inset-0" />
                    <span className="min-w-0">
                      <span className="block text-caption font-medium text-text-heading truncate group-hover:text-primary transition-colors">{bill.name}</span>
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-0.5">
                        <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${STATUS[bill.status].className}`}>{STATUS[bill.status].label}</span>
                        {bill.autoPay && <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-surface-mint text-primary-teal">Auto</span>}
                        {bill.account && <span className="text-[11px] text-text-muted">{bill.account}</span>}
                        {askIfPaid(bill, day) && (
                          <button
                            type="button"
                            onClick={() => onPaid(bill, day.date)}
                            title={`Record ${bill.name} as paid`}
                            className="relative z-10 text-[11px] font-bold text-primary hover:underline"
                          >
                            Paid?
                          </button>
                        )}
                      </span>
                    </span>
                    <span className="text-caption text-text-heading shrink-0">{formatCurrency(bill.amount)}</span>
                  </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/**
 * Bills due in the next 7 days, one card per date, with this month's unpaid past-due
 * bills tucked behind a toggle. "Today" comes from the viewer's
 * clock, not the server's, so the list is right in the evening too.
 */
export default function ThisWeekBills({ budgets: serverBudgets, baseItems, waitingPayments: serverWaiting, accounts, categories }: {
  budgets: UpcomingBudget[]
  baseItems: BaseBudgetItem[]
  waitingPayments: BillPayment[]
  accounts: Account[]
  categories: PriorityCategoryRecord[]
}) {
  // Saved edits land right away, so a changed due day moves the bill to its new date
  const [budgets, applyEdit] = useOptimistic(
    serverBudgets,
    (state: UpcomingBudget[], u: { id: string; patch: Partial<PeriodExpense> }) =>
      state.map((b) => ({ ...b, expenses: b.expenses.map((e) => (e.id === u.id ? { ...e, ...u.patch } : e)) }))
  )
  const [waitingPayments, addWaiting] = useOptimistic(
    serverWaiting as Pick<BillPayment, 'base_item_id' | 'for_month'>[],
    (state, u: { base_item_id: string; for_month: string }) => [...state, u]
  )
  const [editing, setEditing] = useState<UpcomingBill['edit'] | null>(null)
  const [paying, setPaying] = useState<{ bill: UpcomingBill; date: string } | null>(null)
  const onPaid = (bill: UpcomingBill, date: string) => setPaying({ bill, date })
  const tagOptions = [...new Set(baseItems.flatMap((i) => i.tags ?? []))]
  const onEdit = (bill: UpcomingBill) => setEditing(bill.edit)

  const today = useSyncExternalStore(noSubscribe, localToday, () => null)
  const days = today ? upcomingBillsByDay(today, budgets, baseItems, waitingPayments) : []
  const weekTotal = days.reduce((s, d) => s + d.total, 0)
  const pastDue = today ? pastDueBillsByDay(today, budgets) : []
  const pastDueTotal = pastDue.reduce((s, d) => s + d.total, 0)
  const pastDueCount = pastDue.reduce((n, d) => n + d.bills.length, 0)
  const [showPastDue, setShowPastDue] = useState(false)

  return (
    <section aria-labelledby="this-week-heading">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 id="this-week-heading" className="flex items-center gap-2 text-caption font-bold uppercase tracking-wide text-text-muted">
          <CalendarClock size={16} aria-hidden="true" /> Due this week
        </h2>
        {weekTotal > 0 && <span className="text-caption font-bold text-text-heading">{formatCurrency(weekTotal)}</span>}
      </div>

      {pastDueCount > 0 && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowPastDue((v) => !v)}
            aria-expanded={showPastDue}
            className="w-full flex items-center justify-between gap-3 bg-bg-white rounded-full shadow-card px-4 py-2.5 text-caption font-bold text-warning"
          >
            <span className="flex items-center gap-1.5">
              <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${showPastDue ? '' : '-rotate-90'}`} />
              Past due ({pastDueCount})
            </span>
            <span>{formatCurrency(pastDueTotal)}</span>
          </button>
          {showPastDue && <div className="mt-3"><DayCards days={pastDue} onEdit={onEdit} onPaid={onPaid} /></div>}
        </div>
      )}

      {today && days.length === 0 && (
        <div className="bg-bg-white rounded-lg shadow-card p-5 text-caption text-text-muted">
          Nothing due in the next 7 days.
        </div>
      )}

      {days.length > 0 && <DayCards days={days} onEdit={onEdit} onPaid={onPaid} />}

      {editing?.kind === 'expense' && (
        <PeriodExpenseEditModal
          quick
          expense={editing.expense}
          billMonth={editing.month}
          accounts={accounts}
          categories={categories}
          onSaved={(patch) => applyEdit({ id: editing.expense.id, patch })}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'base' && (
        <ExpenseFormModal
          editItem={editing.item}
          accounts={accounts}
          categories={categories}
          tagOptions={tagOptions}
          onClose={() => setEditing(null)}
        />
      )}

      {paying && (
        <MarkPaidModal
          expenseId={paying.bill.edit.kind === 'expense' ? paying.bill.edit.expense.id : undefined}
          baseItemId={paying.bill.edit.kind === 'base' ? paying.bill.edit.item.id : undefined}
          name={paying.bill.name}
          amount={paying.bill.amount}
          account={paying.bill.account}
          accounts={accounts}
          // Auto-pay goes out on its own, so its due date is the likely paid date
          defaultDate={paying.bill.autoPay ? paying.date : undefined}
          billMonth={paying.bill.edit.month}
          onClose={() => setPaying(null)}
          onMarked={(month) => {
            const target = paying.bill.edit
            if (month !== null && month !== target.month) return
            if (target.kind === 'expense') applyEdit({ id: target.expense.id, patch: { paid_outside: true, is_complete: true, cleared: true, paid: true, pay_now: false, session_id: null } })
            else addWaiting({ base_item_id: target.item.id, for_month: `${target.month}-01` })
          }}
        />
      )}
    </section>
  )
}
