'use client'

import { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { formatCurrency, formatCurrencyShort } from '@/lib/utils'
import type { Invoice } from '@/lib/types'

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
}: {
  invoices: Invoice[]
  incomeGoal: number | null
  expenseNeed: number
}) {
  const [mode, setMode] = useState<'projected' | 'received'>('projected')
  const months = chartMonths()

  const data = months.map((m) => {
    const inMonth = (inv: Invoice) =>
      inv.month === m || inv.projected_date?.startsWith(m) || inv.actual_received_date?.startsWith(m)
    const projected = invoices.filter(inMonth).reduce((sum, inv) => sum + inv.amount, 0)
    const received = invoices
      .filter((inv) => inv.status === 'received' && inMonth(inv))
      .reduce((sum, inv) => sum + inv.amount, 0)
    return { month: m, projected, received }
  })

  const goal = incomeGoal && incomeGoal > 0 ? incomeGoal : 0
  const expense = expenseNeed > 0 ? expenseNeed : 0
  const valueFor = (d: { projected: number; received: number }) => (mode === 'projected' ? d.projected : d.received)
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
              return (
                <div key={d.month} className="flex-1 h-full">
                  <div className="relative w-full h-full">
                    {/* income goal (lightest green) — behind */}
                    {goal > 0 && (
                      <div className="absolute bottom-0 inset-x-0 bg-[#cdebcd] rounded-t-sm" style={{ height: pct(goal) }} />
                    )}
                    {/* expense need (medium green) — on top of goal */}
                    {expense > 0 && (
                      <div className="absolute bottom-0 inset-x-0 bg-[#74c07a]/85 rounded-t-sm" style={{ height: pct(expense) }} />
                    )}
                    {/* income (prominent dark green, slightly translucent so target bands show through on overshoot) */}
                    <div className="absolute bottom-0 inset-x-0 bg-success/90 rounded-t-sm min-h-[2px] transition-all" style={{ height: pct(val) }}>
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
                {new Date(d.month + '-01').toLocaleDateString('en-US', { month: 'short' })}
              </span>
            ))}
          </div>

          {/* Key */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-[10px] text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-success" /> Income ({mode})
            </span>
            {expense > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#74c07a]" /> Expense need <span className="font-semibold text-text-heading">{formatCurrency(expense)}</span>
              </span>
            )}
            {goal > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#cdebcd]" /> Income goal <span className="font-semibold text-text-heading">{formatCurrency(goal)}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
