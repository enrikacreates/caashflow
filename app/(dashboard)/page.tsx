import StatCard from '@/components/dashboard/StatCard'
import { GAUGE_COLORS } from '@/components/dashboard/GaugeIcon'
import PeriodSwitcherHeader from '@/components/dashboard/PeriodSwitcherHeader'
import { getBudgetPeriods } from '@/app/actions/periods'
import { getInvoices } from '@/app/actions/invoices'
import { getBaseBudgetItems } from '@/app/actions/base-budget'
import { getSettings } from '@/app/actions/settings'
import { getPeriodDetail } from '@/app/actions/periods'
import { formatCurrency, formatCurrencyShort } from '@/lib/utils'
import { calculateDeductions, calculatePayNowTotal, calculateAccountBreakdown, getNext6Months, calculateMonthlyEquivalent } from '@/lib/calculations'
import type { Invoice } from '@/lib/types'
import { ArrowRightLeft, TrendingUp } from 'lucide-react'

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

  const latestPeriod = periods.length > 0 ? periods[periods.length - 1] : null

  // Use URL param if valid, otherwise fall back to latest
  const selectedPeriod = periodParam
    ? (periods.find((p: { id: string }) => p.id === periodParam) ?? latestPeriod)
    : latestPeriod

  let payNowTotal = 0
  let accountBreakdown: Record<string, number> = {}
  let amountLeft = 0

  if (selectedPeriod) {
    const detail = await getPeriodDetail(selectedPeriod.id)
    payNowTotal = calculatePayNowTotal(detail.expenses)
    accountBreakdown = calculateAccountBreakdown(detail.expenses)
    const deductions = calculateDeductions(
      selectedPeriod.income_amount,
      settings,
      selectedPeriod.deduction_overrides
    )
    amountLeft = deductions.incomeAfterDeductions - payNowTotal
  }

  // 6-Month Cash Flow chart data
  const next6Months = getNext6Months()
  const receivedInvoices = invoices.filter((inv: Invoice) => inv.status === 'received')
  const monthlyTotals = next6Months.map((month) => {
    const total = receivedInvoices
      .filter((inv: Invoice) => inv.month === month || inv.actual_received_date?.startsWith(month))
      .reduce((sum: number, inv: Invoice) => sum + inv.amount, 0)
    return { month, total }
  })
  const maxMonthly = Math.max(...monthlyTotals.map((m) => m.total), 1)

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
    <div className="max-w-3xl mx-auto space-y-8">

      {/* Page Header — period name acts as title with switcher dropdown */}
      <PeriodSwitcherHeader
        currentPeriod={selectedPeriod}
        allPeriods={periods}
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Income"
          value={formatCurrencyShort(selectedPeriod?.income_amount || 0)}
          accentColor="var(--color-category-income)"
          gaugeAngle={incomeAngle}
          gaugeColor={incomeGaugeColor}
        />
        <StatCard
          label="Amount Left"
          value={formatCurrencyShort(amountLeft)}
          accentColor="var(--color-category-expense)"
          gaugeAngle={amountLeftAngle}
          gaugeColor={amountLeftColor}
        />
        <StatCard
          label="Pay Now"
          value={formatCurrencyShort(payNowTotal)}
          accentColor="var(--color-mint)"
          gaugeAngle={payNowAngle}
          gaugeColor={payNowGaugeColor}
        />
        <StatCard
          label="Expenses"
          value={formatCurrencyShort(monthlyExpenses)}
          accentColor="var(--color-category-other)"
          gaugeAngle={expensesAngle}
          gaugeColor={expensesGaugeColor}
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

      {/* 6-Month Cash Flow */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-text-muted" />
          <h2 className="text-caption font-semibold text-text-muted uppercase tracking-wide">6-Month Cash Flow</h2>
        </div>
        <div className="bg-bg-white rounded-lg p-6 shadow-card relative overflow-hidden">

          {/* "FLOW" watermark — Passion One, decorative only */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <span
              className="font-display leading-none text-category-income opacity-30"
              style={{ fontSize: '20rem' }}
            >
              FLOW
            </span>
          </div>

          {/* Chart — sits above watermark */}
          <div className="relative z-10 flex items-end gap-3 h-48">
            {monthlyTotals.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-caption font-bold text-text-heading">
                  {formatCurrency(m.total)}
                </span>
                <div
                  className="w-full bg-primary-teal rounded-t-sm min-h-[4px] transition-all"
                  style={{ height: `${(m.total / maxMonthly) * 100}%` }}
                />
                <span className="text-caption text-text-muted font-medium">
                  {new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short' })}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>

    </div>
  )
}
