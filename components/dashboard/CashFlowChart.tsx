'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp } from 'lucide-react'
import { formatCurrency, formatCurrencyShort } from '@/lib/utils'
import type { Invoice, BudgetPeriod } from '@/lib/types'

/** 6-month window spanning 2 months back → 3 months ahead, so both received (recent) and projected (upcoming) show. */
function chartMonths(): string[] {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

/**
 * 6-month income chart. Each month layers three things, bottom-anchored:
 *  - translucent orange = monthly expense need
 *  - translucent blue = income goal
 *  - solid teal (prominent) = income (projected or received, switchable)
 */
export default function CashFlowChart({
  invoices,
  incomeGoal,
  expenseNeed,
  periods = [],
  manualByMonth = {},
}: {
  invoices: Invoice[]
  incomeGoal: number | null
  expenseNeed: number
  periods?: BudgetPeriod[]
  manualByMonth?: Record<string, number>
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'projected' | 'received'>('projected')
  const months = chartMonths()

  // Map "YYYY-MM" → budget id so each bar can jump into that month's budget
  const periodByMonth = new Map<string, string>()
  for (const p of periods) {
    if (p.period_month) periodByMonth.set(p.period_month.slice(0, 7), p.id)
  }

  const data = months.map((m) => {
    const inMonth = (inv: Invoice) =>
      inv.month === m || inv.projected_date?.startsWith(m) || inv.actual_received_date?.startsWith(m)
    // Manual income (gifts/paybacks excluded upstream) counts as received money in hand
    const manual = manualByMonth[m] ?? 0
    const projected = invoices.filter(inMonth).reduce((sum, inv) => sum + inv.amount, manual)
    const received = invoices
      .filter((inv) => inv.status === 'received' && inMonth(inv))
      .reduce((sum, inv) => sum + inv.amount, manual)
    return { month: m, projected, received }
  })

  const goal = incomeGoal && incomeGoal > 0 ? incomeGoal : 0
  const expense = expenseNeed > 0 ? expenseNeed : 0
  // Projected view is smart per-month: past → received (actual), current/future → projected
  // (all statuses, which already blends received + still-expected). Received view is always actual.
  const nowMonth = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}` })()
  const valueFor = (d: { month: string; projected: number; received: number }) =>
    mode === 'received' ? d.received : d.month < nowMonth ? d.received : d.projected
  const maxVal = Math.max(...data.map(valueFor), goal, expense, 1)
  const pct = (v: number) => `${(v / maxVal) * 100}%`

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-text-muted" />
        <h2 className="text-caption font-semibold text-text-muted uppercase tracking-wide">6-Month Income</h2>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as 'projected' | 'received')}
          className="bg-bg-white border border-border rounded-full px-2.5 py-1 text-caption font-semibold focus:outline-none focus:border-primary transition-colors"
        >
          <option value="projected">Projected</option>
          <option value="received">Received</option>
        </select>
      </div>
      <div className="bg-bg-white rounded-lg p-6 shadow-card relative overflow-hidden">
        {/* "FLOW" watermark — decorative */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="font-display leading-none text-[#ebf0f0]" style={{ fontSize: '20rem' }}>FLOW</span>
        </div>

        <div className="relative z-10">
          <div className="flex items-end gap-3 h-48">
            {data.map((d) => {
              const val = valueFor(d)
              const periodId = periodByMonth.get(d.month)
              return (
                <div
                  key={d.month}
                  className={`flex-1 h-full ${periodId ? 'cursor-pointer group' : ''}`}
                  onClick={periodId ? () => router.push(`/periods/${periodId}`) : undefined}
                  title={periodId ? "Open this month's budget" : undefined}
                >
                  <div className="relative w-full h-full">
                    {/* income goal (lightest teal tint) — behind; value floats above as the ceiling */}
                    {goal > 0 && (
                      <div className="absolute bottom-0 inset-x-0 bg-[#c4ebe5] rounded-t-sm" style={{ height: pct(goal) }}>
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-text-muted whitespace-nowrap">
                          {formatCurrencyShort(goal)}
                        </span>
                      </div>
                    )}
                    {/* expense need (medium teal tint) — on top of goal; value sits inside near its top */}
                    {expense > 0 && (
                      <div className="absolute bottom-0 inset-x-0 bg-[#aed9d2] rounded-t-sm" style={{ height: pct(expense) }}>
                        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-[#0e7c70] whitespace-nowrap">
                          {formatCurrencyShort(expense)}
                        </span>
                      </div>
                    )}
                    {/* income (prominent teal, slightly translucent so target bands show through on overshoot) */}
                    <div className="absolute bottom-0 inset-x-0 bg-primary-teal/85 group-hover:bg-primary-teal rounded-t-sm min-h-[2px] transition-all" style={{ height: pct(val) }}>
                      {val > 0 && (
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-text-heading whitespace-nowrap">
                          {formatCurrencyShort(val)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-3 mt-2">
            {data.map((d) => (
              <span key={d.month} className="flex-1 text-center text-caption text-text-muted font-medium">
                {new Date(d.month + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
              </span>
            ))}
          </div>

          {/* Key */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-[10px] text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary-teal" /> Income ({mode})
            </span>
            {expense > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#aed9d2]" /> Expense need <span className="font-semibold text-text-heading">{formatCurrency(expense)}</span>
              </span>
            )}
            {goal > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#c4ebe5]" /> Income goal <span className="font-semibold text-text-heading">{formatCurrency(goal)}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
