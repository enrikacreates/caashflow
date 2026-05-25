import { TrendingUp } from 'lucide-react'
import { getNext6Months } from '@/lib/calculations'
import { formatCurrency, formatCurrencyShort } from '@/lib/utils'
import type { Invoice } from '@/lib/types'

/** 6-month projected income (all statuses) per month, against the monthly income goal. */
export default function CashFlowChart({
  invoices,
  incomeGoal,
}: {
  invoices: Invoice[]
  incomeGoal: number | null
}) {
  const months = getNext6Months()
  const data = months.map((m) => {
    const projected = invoices
      .filter((inv) => inv.month === m || inv.projected_date?.startsWith(m) || inv.actual_received_date?.startsWith(m))
      .reduce((sum, inv) => sum + inv.amount, 0)
    return { month: m, projected }
  })
  const goal = incomeGoal && incomeGoal > 0 ? incomeGoal : 0
  const maxVal = Math.max(...data.map((d) => d.projected), goal, 1)

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-text-muted" />
          <h2 className="text-caption font-semibold text-text-muted uppercase tracking-wide">6-Month Projected Income</h2>
        </div>
        {goal > 0 && (
          <span className="text-caption text-text-muted">
            Goal <span className="font-bold text-text-heading">{formatCurrency(goal)}</span>/mo
          </span>
        )}
      </div>
      <div className="bg-bg-white rounded-lg p-6 shadow-card relative overflow-hidden">
        {/* "FLOW" watermark — decorative */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="font-display leading-none text-[#ebf0f0]" style={{ fontSize: '20rem' }}>FLOW</span>
        </div>

        <div className="relative z-10">
          <div className="relative flex items-end gap-3 h-48">
            {/* Goal line */}
            {goal > 0 && (
              <div
                className="absolute left-0 right-0 z-20 border-t-2 border-dashed border-text-heading/40"
                style={{ bottom: `${(goal / maxVal) * 100}%` }}
              >
                <span className="absolute right-0 -top-4 text-[10px] font-semibold text-text-muted">goal</span>
              </div>
            )}
            {data.map((d) => {
              const met = goal > 0 && d.projected >= goal
              return (
                <div key={d.month} className="flex-1 flex items-end h-full">
                  <div
                    className={`relative w-full rounded-t-sm min-h-[4px] transition-all ${met ? 'bg-success' : 'bg-primary-teal'}`}
                    style={{ height: `${(d.projected / maxVal) * 100}%` }}
                  >
                    {d.projected > 0 && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-text-heading whitespace-nowrap">
                        {formatCurrencyShort(d.projected)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-3 mt-2">
            {data.map((d) => (
              <span key={d.month} className="flex-1 text-center text-caption text-text-muted font-medium">
                {new Date(d.month + '-01').toLocaleDateString('en-US', { month: 'short' })}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
