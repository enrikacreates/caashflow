import PeriodSwitcherHeader from '@/components/dashboard/PeriodSwitcherHeader'
import NewBudgetButton from '@/components/dashboard/NewBudgetButton'
import CashFlowChart from '@/components/dashboard/CashFlowChart'
import BudgetSummaryBar from '@/components/dashboard/BudgetSummaryBar'
import { getBudgetPeriods, getPeriodDetail } from '@/app/actions/periods'
import { getInvoices } from '@/app/actions/invoices'
import { getBaseBudgetItems } from '@/app/actions/base-budget'
import { getSettings } from '@/app/actions/settings'
import { getOwedAmount } from '@/lib/utils'
import { calculateDeductions, calculatePayNowTotal, calculateMonthlyEquivalent } from '@/lib/calculations'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: periodParam } = await searchParams

  const [periods, invoices, baseItems, settings] = await Promise.all([
    getBudgetPeriods(),
    getInvoices(),
    getBaseBudgetItems(),
    getSettings(),
  ])

  // "Latest" = the budget for the most recent month (not just the most recently created row)
  const latestPeriod = periods.length > 0
    ? [...periods].sort((a: { period_month: string | null }, b: { period_month: string | null }) =>
        (a.period_month ?? '').localeCompare(b.period_month ?? '')
      )[periods.length - 1]
    : null

  // Use URL param if valid, otherwise fall back to latest
  const selectedPeriod = periodParam
    ? (periods.find((p: { id: string }) => p.id === periodParam) ?? latestPeriod)
    : latestPeriod

  let payNowTotal = 0
  let amountLeft = 0
  let incomeAfterDeductions = 0
  let totalExpenses = 0
  let stillToFund = 0

  if (selectedPeriod) {
    const detail = await getPeriodDetail(selectedPeriod.id)
    payNowTotal = calculatePayNowTotal(detail.expenses)
    const deductions = calculateDeductions(
      selectedPeriod.income_amount,
      settings,
      selectedPeriod.deduction_overrides
    )
    // Period adjustments (e.g. misc +/-) raise or lower what's left to budget.
    const adjustment = (detail.adjustments ?? []).reduce((sum, a) => sum + (a.amount || 0), 0)
    incomeAfterDeductions = deductions.incomeAfterDeductions
    amountLeft = deductions.incomeAfterDeductions + adjustment - payNowTotal
    // Full expense total (all lines, not just pay-now) and what still has no income behind it
    totalExpenses = detail.expenses.reduce((sum, e) => {
      if (e.is_split) return sum + (e.payments ?? []).reduce((s: number, p: { amount: number }) => s + p.amount, 0)
      return sum + getOwedAmount(e)
    }, 0)
    stillToFund = Math.max(0, totalExpenses - payNowTotal)
  }

  // Income still expected this month — invoices dated this month not yet received
  const periodMonth = selectedPeriod?.period_month?.slice(0, 7) ?? ''
  const stillProjected = periodMonth
    ? invoices
        .filter((inv) => inv.status !== 'received' && (inv.month === periodMonth || inv.projected_date?.startsWith(periodMonth) || inv.actual_received_date?.startsWith(periodMonth)))
        .reduce((sum: number, inv) => sum + inv.amount, 0)
    : 0

  // Chart's expense-need band — monthly-equivalent of the baseline expenses
  const monthlyExpenses = calculateMonthlyEquivalent(baseItems)

  return (
    <div className="space-y-8">

      {/* Page Header — period name acts as title with switcher dropdown */}
      <div className="flex items-start justify-between gap-4">
        <PeriodSwitcherHeader
          currentPeriod={selectedPeriod}
          allPeriods={periods}
        />
        <NewBudgetButton />
      </div>

      {/* Live-budgeting metrics for the current budget */}
      {selectedPeriod && (
        <BudgetSummaryBar
          income={selectedPeriod.income_amount}
          toBudget={incomeAfterDeductions}
          payNow={payNowTotal}
          amountLeft={amountLeft}
          totalExpenses={totalExpenses}
          stillToFund={stillToFund}
          stillProjected={stillProjected}
        />
      )}

      {/* 6-Month Projected Income vs Goal */}
      <CashFlowChart invoices={invoices} incomeGoal={settings.monthly_income_goal} expenseNeed={monthlyExpenses} periods={periods} />

    </div>
  )
}
