import StatCard from '@/components/dashboard/StatCard'
import { GAUGE_COLORS } from '@/components/dashboard/GaugeIcon'
import PeriodSwitcherHeader from '@/components/dashboard/PeriodSwitcherHeader'
import NewBudgetButton from '@/components/dashboard/NewBudgetButton'
import CashFlowChart from '@/components/dashboard/CashFlowChart'
import { getBudgetPeriods } from '@/app/actions/periods'
import { getInvoices } from '@/app/actions/invoices'
import { getBaseBudgetItems } from '@/app/actions/base-budget'
import { getSettings } from '@/app/actions/settings'
import { getPeriodDetail } from '@/app/actions/periods'
import { formatCurrency, formatCurrencyShort } from '@/lib/utils'
import { calculateDeductions, calculatePayNowTotal, calculateAccountBreakdown, getDeductionAccountAllocations, calculateMonthlyEquivalent } from '@/lib/calculations'
import { ArrowRightLeft, TrendingUp, Wallet, Clock, Receipt } from 'lucide-react'

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
  let accountBreakdown: Record<string, number> = {}
  let amountLeft = 0
  let incomeAfterDeductions = 0

  if (selectedPeriod) {
    const detail = await getPeriodDetail(selectedPeriod.id)
    payNowTotal = calculatePayNowTotal(detail.expenses)
    const deductions = calculateDeductions(
      selectedPeriod.income_amount,
      settings,
      selectedPeriod.deduction_overrides
    )
    accountBreakdown = calculateAccountBreakdown(
      detail.expenses,
      getDeductionAccountAllocations(deductions, settings)
    )
    incomeAfterDeductions = deductions.incomeAfterDeductions
    amountLeft = deductions.incomeAfterDeductions - payNowTotal
  }

  // Monthly-equivalent total — normalizes Weekly (×52/12), Annual (÷12), excludes One-Time
  const monthlyExpenses = calculateMonthlyEquivalent(baseItems)

  // --- Gauge angles & colors ---
  // Needle range: -80 (full left = bad) → 0 (center) → +80 (full right = healthy)
  const safeIncome = Math.max(selectedPeriod?.income_amount ?? 0, 1)

  // Income — goal-aware if monthly_income_goal is set, else falls back to expense coverage ratio
  // With goal: 0% of goal = -80° red / 50% = center amber / 100%+ = +80° green
  const incomeGoal = settings.monthly_income_goal
  const incomeTarget = incomeGoal ?? monthlyExpenses
  const incomeRatio = (selectedPeriod?.income_amount ?? 0) / Math.max(incomeTarget, 1)
  const incomeAngle = Math.max(-80, Math.min(80, Math.round((incomeRatio - 0.5) * 160)))
  const incomeGaugeColor =
    incomeAngle > 30  ? GAUGE_COLORS.green :
    incomeAngle > -30 ? GAUGE_COLORS.amber :
                        GAUGE_COLORS.red

  // Amount Left — proportional to income; red if over budget, green if positive
  const amountLeftAngle = Math.max(-80, Math.min(80, Math.round((amountLeft / safeIncome) * 80)))
  const amountLeftColor = amountLeft >= 0 ? GAUGE_COLORS.green : GAUGE_COLORS.red

  // Pay Now — lower spend vs income = healthier (right); three-state color
  const payNowAngle = Math.max(-80, Math.min(80, Math.round((1 - payNowTotal / safeIncome) * 80)))
  const payNowGaugeColor =
    payNowAngle > 30  ? GAUGE_COLORS.green :
    payNowAngle > -30 ? GAUGE_COLORS.amber :
                        GAUGE_COLORS.red

  // Expenses — goal-aware if monthly_expense_goal is set
  // With goal: green = at/under goal, amber = ≤10% over, red = >10% over
  // Without goal: falls back to ratio vs income
  const expenseGoal = settings.monthly_expense_goal
  let expensesAngle: number
  let expensesGaugeColor: string
  if (expenseGoal) {
    const overage = monthlyExpenses - expenseGoal
    if (overage <= 0) {
      // Under or at goal — map 0→goal onto +80→0
      expensesAngle = Math.max(0, Math.min(80, Math.round((1 - monthlyExpenses / expenseGoal) * 80)))
      expensesGaugeColor = GAUGE_COLORS.green
    } else if (overage <= expenseGoal * 0.1) {
      // Within 10% over goal — amber zone
      expensesAngle = Math.round(-40 * (overage / (expenseGoal * 0.1)))
      expensesGaugeColor = GAUGE_COLORS.amber
    } else {
      // More than 10% over goal — red, full left
      expensesAngle = Math.max(-80, Math.round(-40 - 40 * Math.min(1, (overage - expenseGoal * 0.1) / (expenseGoal * 0.1))))
      expensesGaugeColor = GAUGE_COLORS.red
    }
  } else {
    expensesAngle = Math.max(-80, Math.min(80, Math.round((1 - monthlyExpenses / safeIncome) * 80)))
    expensesGaugeColor =
      expensesAngle > 30  ? GAUGE_COLORS.green :
      expensesAngle > -30 ? GAUGE_COLORS.amber :
                            GAUGE_COLORS.red
  }

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

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Income"
          value={formatCurrencyShort(selectedPeriod?.income_amount || 0)}
          accentColor="var(--color-category-income)"
          gaugeAngle={incomeAngle}
          gaugeColor={incomeGaugeColor}
          icon={TrendingUp}
          subtitle={incomeGoal ? `of ${formatCurrencyShort(incomeGoal)} goal` : `of ${formatCurrencyShort(monthlyExpenses)} expenses`}
        />
        <StatCard
          label="Remaining"
          value={formatCurrencyShort(amountLeft)}
          accentColor="var(--color-category-expense)"
          gaugeAngle={amountLeftAngle}
          gaugeColor={amountLeftColor}
          icon={Wallet}
          subtitle={incomeAfterDeductions > 0 ? `of ${formatCurrencyShort(incomeAfterDeductions)} to budget` : undefined}
        />
        <StatCard
          label="Pay Now"
          value={formatCurrencyShort(payNowTotal)}
          accentColor="var(--color-mint)"
          gaugeAngle={payNowAngle}
          gaugeColor={payNowGaugeColor}
          icon={Clock}
          subtitle={incomeAfterDeductions > 0 ? `of ${formatCurrencyShort(incomeAfterDeductions)} to pay` : undefined}
        />
        <StatCard
          label="Expenses"
          value={formatCurrencyShort(monthlyExpenses)}
          accentColor="var(--color-category-other)"
          gaugeAngle={expensesAngle}
          gaugeColor={expensesGaugeColor}
          icon={Receipt}
          subtitle={expenseGoal ? `of ${formatCurrencyShort(expenseGoal)} goal` : undefined}
        />
      </div>

      {/* Account Transfer Summary */}
      {Object.keys(accountBreakdown).length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ArrowRightLeft size={16} className="text-text-muted" />
            <h2 className="text-caption font-semibold text-text-muted uppercase tracking-wide">Account Transfers</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(accountBreakdown).map(([account, total]) => (
              <div key={account} className="bg-bg-white rounded-lg p-6 shadow-card">
                <p className="text-caption font-bold uppercase text-text-muted mb-1">{account}</p>
                <p className="text-h2 font-bold text-text-heading">{formatCurrency(total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6-Month Projected Income vs Goal */}
      <CashFlowChart invoices={invoices} incomeGoal={settings.monthly_income_goal} expenseNeed={monthlyExpenses} />

    </div>
  )
}
