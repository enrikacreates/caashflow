import PeriodSwitcherHeader from '@/components/dashboard/PeriodSwitcherHeader'
import NewBudgetButton from '@/components/dashboard/NewBudgetButton'
import CashFlowChart from '@/components/dashboard/CashFlowChart'
import BudgetSummaryBar from '@/components/dashboard/BudgetSummaryBar'
import { getBudgetPeriods, getPeriodDetail } from '@/app/actions/periods'
import { getInvoices } from '@/app/actions/invoices'
import { getBaseBudgetItems } from '@/app/actions/base-budget'
import { getSettings } from '@/app/actions/settings'
import { getSavingsGoals } from '@/app/actions/savings'
import { getDebts } from '@/app/actions/debts'
import { getOwedAmount, formatCurrency, formatCurrencyShort } from '@/lib/utils'
import { calculateDeductions, calculatePayNowTotal, calculateMonthlyEquivalent } from '@/lib/calculations'
import { CalendarClock, PiggyBank, Hammer, ArrowUpRight, ArrowDownRight } from 'lucide-react'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: periodParam } = await searchParams

  const [periods, invoices, baseItems, settings, savingsGoals, debts] = await Promise.all([
    getBudgetPeriods(),
    getInvoices(),
    getBaseBudgetItems(),
    getSettings(),
    getSavingsGoals(),
    getDebts(),
  ])

  // Periods sorted oldest→newest by month, so we can pick "latest" and "previous"
  const byMonth = [...periods].sort((a: { period_month: string | null }, b: { period_month: string | null }) =>
    (a.period_month ?? '').localeCompare(b.period_month ?? '')
  )
  const latestPeriod = byMonth.length > 0 ? byMonth[byMonth.length - 1] : null

  const selectedPeriod = periodParam
    ? (periods.find((p: { id: string }) => p.id === periodParam) ?? latestPeriod)
    : latestPeriod

  const selectedIdx = selectedPeriod ? byMonth.findIndex((p) => p.id === selectedPeriod.id) : -1
  const prevPeriod = selectedIdx > 0 ? byMonth[selectedIdx - 1] : null
  const incomeDelta = selectedPeriod && prevPeriod ? selectedPeriod.income_amount - prevPeriod.income_amount : null

  let payNowTotal = 0
  let amountLeft = 0
  let incomeAfterDeductions = 0
  let totalExpenses = 0
  let stillToFund = 0
  let nextBills: { id: string; name: string; due: number; amount: number }[] = []

  if (selectedPeriod) {
    const detail = await getPeriodDetail(selectedPeriod.id)
    payNowTotal = calculatePayNowTotal(detail.expenses)
    const deductions = calculateDeductions(selectedPeriod.income_amount, settings, selectedPeriod.deduction_overrides)
    const adjustment = (detail.adjustments ?? []).reduce((sum, a) => sum + (a.amount || 0), 0)
    incomeAfterDeductions = deductions.incomeAfterDeductions
    amountLeft = deductions.incomeAfterDeductions + adjustment - payNowTotal
    totalExpenses = detail.expenses.reduce((sum, e) => {
      if (e.is_split) return sum + (e.payments ?? []).reduce((s: number, p: { amount: number }) => s + p.amount, 0)
      return sum + getOwedAmount(e)
    }, 0)
    stillToFund = Math.max(0, totalExpenses - payNowTotal)
    // Soonest unpaid bills with a due day
    nextBills = detail.expenses
      .filter((e) => !e.paid && !e.is_complete && e.due_day != null)
      .sort((a, b) => (a.due_day ?? 99) - (b.due_day ?? 99))
      .slice(0, 5)
      .map((e) => ({ id: e.id, name: e.name, due: e.due_day as number, amount: getOwedAmount(e) }))
  }

  // Income still expected this month — invoices dated this month not yet received
  const periodMonth = selectedPeriod?.period_month?.slice(0, 7) ?? ''
  const stillProjected = periodMonth
    ? invoices
        .filter((inv) => inv.status !== 'received' && (inv.month === periodMonth || inv.projected_date?.startsWith(periodMonth) || inv.actual_received_date?.startsWith(periodMonth)))
        .reduce((sum: number, inv) => sum + inv.amount, 0)
    : 0

  // Days left in the current calendar month — pace for closing the funding gap
  const now = new Date()
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()

  // Savings & debt snapshots
  const activeGoals = savingsGoals.filter((g) => !g.is_achieved)
  const savedTotal = activeGoals.reduce((s, g) => s + g.current_amount, 0)
  const savedTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0)
  const activeDebts = debts.filter((d) => !d.is_paid_off)
  const debtOriginal = activeDebts.reduce((s, d) => s + d.original_balance, 0)
  const debtCurrent = activeDebts.reduce((s, d) => s + d.current_balance, 0)
  const debtPaid = Math.max(0, debtOriginal - debtCurrent)

  const monthlyExpenses = calculateMonthlyEquivalent(baseItems)
  const cardLabel = 'flex items-center gap-2 text-caption font-bold uppercase tracking-wide text-text-muted mb-3'

  return (
    <div className="space-y-8">

      {/* Latest budget — header + live metrics in one card */}
      <div className="bg-bg-white rounded-lg shadow-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <PeriodSwitcherHeader currentPeriod={selectedPeriod} allPeriods={periods} />
          <NewBudgetButton />
        </div>
        {selectedPeriod && (
          <BudgetSummaryBar
            bare
            income={selectedPeriod.income_amount}
            toBudget={incomeAfterDeductions}
            payNow={payNowTotal}
            amountLeft={amountLeft}
            totalExpenses={totalExpenses}
            stillToFund={stillToFund}
            stillProjected={stillProjected}
            daysLeft={daysLeft}
          />
        )}
      </div>

      {/* 6-Month Income — primary cash-flow view, kept up top */}
      <CashFlowChart invoices={invoices} incomeGoal={settings.monthly_income_goal} expenseNeed={monthlyExpenses} periods={periods} />

      {/* Insight cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {nextBills.length > 0 && (
          <div className="bg-bg-white rounded-lg shadow-card p-5">
            <div className={cardLabel}><CalendarClock size={16} /> Next bills due</div>
            <ul className="space-y-2">
              {nextBills.map((b) => (
                <li key={b.id} className="flex items-center justify-between text-caption">
                  <span className="text-text-heading font-medium truncate mr-3">{b.name}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-text-muted">the {b.due}{b.due === 1 ? 'st' : b.due === 2 ? 'nd' : b.due === 3 ? 'rd' : 'th'}</span>
                    <span className="font-bold text-text-heading w-20 text-right">{formatCurrency(b.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {incomeDelta != null && prevPeriod && (
          <div className="bg-bg-white rounded-lg shadow-card p-5">
            <div className={cardLabel}>
              {incomeDelta >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />} Income vs last month
            </div>
            <div className={`text-h2 font-bold ${incomeDelta >= 0 ? 'text-success' : 'text-warning'}`}>
              {incomeDelta >= 0 ? '+' : '−'}{formatCurrency(Math.abs(incomeDelta))}
            </div>
            <p className="text-caption text-text-muted mt-1">
              {formatCurrencyShort(selectedPeriod?.income_amount ?? 0)} this month vs {formatCurrencyShort(prevPeriod.income_amount)} in {prevPeriod.period_name}
            </p>
          </div>
        )}

        {activeGoals.length > 0 && (
          <div className="bg-bg-white rounded-lg shadow-card p-5">
            <div className={cardLabel}><PiggyBank size={16} /> Savings progress</div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-h3 font-bold text-text-heading">{formatCurrency(savedTotal)}</span>
              <span className="text-caption text-text-muted">of {formatCurrency(savedTarget)}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-gray overflow-hidden">
              <div className="h-full bg-primary-teal rounded-full" style={{ width: `${savedTarget > 0 ? Math.min(100, (savedTotal / savedTarget) * 100) : 0}%` }} />
            </div>
            <p className="text-caption text-text-muted mt-2">{activeGoals.length} active {activeGoals.length === 1 ? 'goal' : 'goals'}</p>
          </div>
        )}

        {activeDebts.length > 0 && (
          <div className="bg-bg-white rounded-lg shadow-card p-5">
            <div className={cardLabel}><Hammer size={16} /> Debt paid down</div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-h3 font-bold text-text-heading">{formatCurrency(debtPaid)}</span>
              <span className="text-caption text-text-muted">of {formatCurrency(debtOriginal)}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-gray overflow-hidden">
              <div className="h-full bg-success rounded-full" style={{ width: `${debtOriginal > 0 ? Math.min(100, (debtPaid / debtOriginal) * 100) : 0}%` }} />
            </div>
            <p className="text-caption text-text-muted mt-2">{formatCurrency(debtCurrent)} remaining across {activeDebts.length} {activeDebts.length === 1 ? 'debt' : 'debts'}</p>
          </div>
        )}
      </div>

    </div>
  )
}
