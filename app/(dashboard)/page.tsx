import { getBudgetPeriods } from '@/app/actions/periods'
import { getInvoices } from '@/app/actions/invoices'
import { getBaseBudgetItems } from '@/app/actions/base-budget'
import { getSettings } from '@/app/actions/settings'
import { getPeriodDetail } from '@/app/actions/periods'
import { formatCurrency } from '@/lib/utils'
import { calculateDeductions, calculatePayNowTotal, calculateAccountBreakdown, getNext6Months } from '@/lib/calculations'
import type { Invoice } from '@/lib/types'

export default async function DashboardPage() {
  const [periods, invoices, baseItems, settings] = await Promise.all([
    getBudgetPeriods(),
    getInvoices(),
    getBaseBudgetItems(),
    getSettings(),
  ])

  // Get latest period (last in array by created_at)
  const latestPeriod = periods.length > 0 ? periods[periods.length - 1] : null

  let expenses: Awaited<ReturnType<typeof getPeriodDetail>>['expenses'] = []
  let payNowTotal = 0
  let accountBreakdown: Record<string, number> = {}
  let incomeAfterDeductions = 0
  let amountLeft = 0

  if (latestPeriod) {
    const detail = await getPeriodDetail(latestPeriod.id)
    expenses = detail.expenses
    payNowTotal = calculatePayNowTotal(detail.expenses)
    accountBreakdown = calculateAccountBreakdown(detail.expenses)
    const deductions = calculateDeductions(
      latestPeriod.income_amount,
      settings,
      latestPeriod.deduction_overrides
    )
    incomeAfterDeductions = deductions.incomeAfterDeductions
    amountLeft = incomeAfterDeductions - payNowTotal
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

  // Quick stats
  const monthlyExpenses = baseItems
    .filter((item) => item.frequency === 'Monthly')
    .reduce((sum, item) => sum + item.default_amount, 0)
  const monthlyDebt = baseItems
    .filter((item) => item.priority_category === 'P3: Debt' && item.frequency === 'Monthly')
    .reduce((sum, item) => sum + item.default_amount, 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black font-display text-ink">Dashboard</h1>
        <p className="text-muted text-sm mt-1">Your financial overview at a glance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-line rounded-[20px] p-6">
          <div className="text-xs font-bold uppercase text-muted mb-1">Current Period</div>
          <div className="text-lg font-bold text-ink">
            {latestPeriod ? latestPeriod.period_name : 'No periods yet'}
          </div>
        </div>
        <div className="bg-white border border-line rounded-[20px] p-6">
          <div className="text-xs font-bold uppercase text-muted mb-1">Total Income</div>
          <div className="text-lg font-bold text-ink">
            {formatCurrency(latestPeriod?.income_amount || 0)}
          </div>
        </div>
        <div className="bg-white border border-line rounded-[20px] p-6">
          <div className="text-xs font-bold uppercase text-muted mb-1">Pay Now Total</div>
          <div className="text-lg font-bold text-ink">
            {formatCurrency(payNowTotal)}
          </div>
        </div>
        <div className="bg-white border border-line rounded-[20px] p-6">
          <div className="text-xs font-bold uppercase text-muted mb-1">Amount Left</div>
          <div className={`text-lg font-bold ${amountLeft >= 0 ? 'text-green' : 'text-orange'}`}>
            {formatCurrency(amountLeft)}
          </div>
        </div>
      </div>

      {/* Account Transfer Summary */}
      {Object.keys(accountBreakdown).length > 0 && (
        <div>
          <h2 className="text-xl font-black font-display text-ink mb-4">Account Transfer Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(accountBreakdown).map(([account, total]) => (
              <div key={account} className="bg-white border border-line rounded-[20px] p-6">
                <div className="text-xs font-bold uppercase text-muted mb-1">{account}</div>
                <div className="text-lg font-bold text-ink">{formatCurrency(total)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6-Month Cash Flow Chart */}
      <div>
        <h2 className="text-xl font-black font-display text-ink mb-4">6-Month Cash Flow</h2>
        <div className="bg-white border border-line rounded-[20px] p-6">
          <div className="flex items-end gap-3 h-48">
            {monthlyTotals.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-xs font-bold text-ink">
                  {formatCurrency(m.total)}
                </div>
                <div
                  className="w-full bg-blue rounded-t-[8px] min-h-[4px] transition-all"
                  style={{ height: `${(m.total / maxMonthly) * 100}%` }}
                />
                <div className="text-xs text-muted font-medium">
                  {new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div>
        <h2 className="text-xl font-black font-display text-ink mb-4">Quick Stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-line rounded-[20px] p-6">
            <div className="text-xs font-bold uppercase text-muted mb-1">
              Total Monthly Expenses (Base Budget)
            </div>
            <div className="text-lg font-bold text-ink">{formatCurrency(monthlyExpenses)}</div>
          </div>
          <div className="bg-white border border-line rounded-[20px] p-6">
            <div className="text-xs font-bold uppercase text-muted mb-1">
              Monthly Debt Payments
            </div>
            <div className="text-lg font-bold text-ink">{formatCurrency(monthlyDebt)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
