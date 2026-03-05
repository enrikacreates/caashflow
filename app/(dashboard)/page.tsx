import StatCard from '@/components/dashboard/StatCard'
import PeriodSwitcherHeader from '@/components/dashboard/PeriodSwitcherHeader'
import { getBudgetPeriods } from '@/app/actions/periods'
import { getInvoices } from '@/app/actions/invoices'
import { getBaseBudgetItems } from '@/app/actions/base-budget'
import { getSettings } from '@/app/actions/settings'
import { getPeriodDetail } from '@/app/actions/periods'
import { formatCurrency, formatCurrencyShort } from '@/lib/utils'
import { calculateDeductions, calculatePayNowTotal, calculateAccountBreakdown, getNext6Months } from '@/lib/calculations'
import type { Invoice } from '@/lib/types'

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

  // Monthly expenses total from base budget
  const monthlyExpenses = baseItems
    .filter((item) => item.frequency === 'Monthly')
    .reduce((sum, item) => sum + item.default_amount, 0)

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
        />
        <StatCard
          label="Amount Left"
          value={formatCurrencyShort(amountLeft)}
          accentColor="var(--color-category-expense)"
        />
        <StatCard
          label="Pay Now"
          value={formatCurrencyShort(payNowTotal)}
          accentColor="var(--color-mint)"
        />
        <StatCard
          label="Expenses"
          value={formatCurrencyShort(monthlyExpenses)}
          accentColor="var(--color-category-other)"
        />
      </div>

      {/* Account Transfer Summary */}
      {Object.keys(accountBreakdown).length > 0 && (
        <div>
          <h2 className="text-h2 font-semibold text-text-heading mb-4">Account Transfers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(accountBreakdown).map(([account, total]) => (
              <div key={account} className="bg-bg-white rounded-lg p-6 shadow-card">
                <p className="text-caption font-bold uppercase text-text-muted mb-1">{account}</p>
                <p className="text-h3 font-semibold text-text-heading">{formatCurrency(total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6-Month Cash Flow */}
      <div>
        <h2 className="text-h2 font-semibold text-text-heading mb-4">6-Month Cash Flow</h2>
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
