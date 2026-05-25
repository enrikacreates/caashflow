import { formatCurrency } from '@/lib/utils'

/**
 * The live-budgeting metrics row, shared by the dashboard and a period's detail page.
 * Amount Left is the "get to zero" target; the Still-to-fund banner shows how much
 * of the period's expenses still has no income behind it.
 */
export default function BudgetSummaryBar({
  income,
  toBudget,
  payNow,
  amountLeft,
  totalExpenses,
  stillToFund,
  stillProjected,
}: {
  income: number
  toBudget: number
  payNow: number
  amountLeft: number
  totalExpenses: number
  stillToFund: number
  stillProjected: number
}) {
  return (
    <div className="bg-bg-white rounded-lg shadow-card p-4 sm:p-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-4 sm:divide-x sm:divide-border/60">
        <div className="@container sm:px-3 first:pl-0">
          <div className="text-caption font-bold uppercase text-text-muted mb-1">Total Income</div>
          <div className="font-bold text-text-heading whitespace-nowrap leading-tight text-[clamp(0.78rem,15cqi,1.5rem)]">{formatCurrency(income)}</div>
          <div className="text-[10px] text-text-muted mt-0.5 leading-tight">{formatCurrency(stillProjected)} still projected this month</div>
        </div>
        <div className="@container sm:px-3">
          <div className="text-caption font-bold uppercase text-text-muted mb-1">To Budget</div>
          <div className="font-bold text-text-heading whitespace-nowrap leading-tight text-[clamp(0.78rem,15cqi,1.5rem)]">{formatCurrency(toBudget)}</div>
        </div>
        <div className="@container sm:px-3">
          <div className="text-caption font-bold uppercase text-text-muted mb-1">Pay Now</div>
          <div className="font-bold text-text-heading whitespace-nowrap leading-tight text-[clamp(0.78rem,15cqi,1.5rem)]">{formatCurrency(payNow)}</div>
        </div>
        <div className="@container sm:px-3">
          <div className="text-caption font-bold uppercase text-text-muted mb-1">Amount Left</div>
          <div className={`font-bold whitespace-nowrap leading-tight text-[clamp(0.78rem,15cqi,1.5rem)] ${amountLeft >= 0 ? 'text-success' : 'text-warning'}`}>
            {formatCurrency(amountLeft)}
          </div>
        </div>
      </div>
      {totalExpenses > 0 && (
        <div className={`mt-4 rounded-md px-3 py-2.5 flex items-center justify-between ${stillToFund > 0 ? 'bg-warning/10' : 'bg-success/10'}`}>
          <span className="text-caption font-bold uppercase tracking-wide text-text-muted">
            {stillToFund > 0 ? 'Still to fund' : 'Fully funded'}
          </span>
          <span className={`text-label font-bold ${stillToFund > 0 ? 'text-warning' : 'text-success'}`}>
            {stillToFund > 0
              ? <>{formatCurrency(stillToFund)} <span className="font-medium text-text-muted">of {formatCurrency(totalExpenses)} expenses</span></>
              : 'All expenses funded'}
          </span>
        </div>
      )}
    </div>
  )
}
