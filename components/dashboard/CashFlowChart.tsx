'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency, formatCurrencyShort } from '@/lib/utils'
import type { Invoice, BudgetPeriod } from '@/lib/types'

/** 6-month window spanning 2 months back → 3 months ahead, shifted by `offset` months for prev/next browsing. */
function chartMonths(offset = 0): string[] {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 2 + i + offset, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

// A gentle repeating wave crest, stretched to full width (preserveAspectRatio none).
const WAVE_D = 'M0,9 C150,2 300,2 450,9 C600,16 750,16 900,9 C1050,2 1200,2 1200,9'

/** Translucent "water" filled from the baseline up to `levelPct`, capped with a wave crest. */
function WaveLayer({ levelPct, color }: { levelPct: number; color: string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: `${levelPct}%` }}>
      <div className="absolute inset-0" style={{ backgroundColor: color }} />
      <svg className="absolute inset-x-0 w-full" style={{ bottom: '100%', height: 9 }} viewBox="0 0 1200 18" preserveAspectRatio="none" aria-hidden="true">
        <path d={`${WAVE_D} L1200,18 L0,18 Z`} fill={color} />
      </svg>
    </div>
  )
}

/** Smooth (Catmull-Rom → cubic bezier) path through points, for the connected income wave. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
  }
  return d
}

/** A wave-shaped line marking a waterline (e.g. the income goal) — no fill. */
function WaveLine({ levelPct, color }: { levelPct: number; color: string }) {
  return (
    <svg className="absolute inset-x-0 w-full pointer-events-none" style={{ bottom: `${levelPct}%`, height: 10, transform: 'translateY(50%)' }} viewBox="0 0 1200 18" preserveAspectRatio="none" aria-hidden="true">
      <path d={WAVE_D} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
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
  const [monthOffset, setMonthOffset] = useState(0)
  const months = chartMonths(monthOffset)

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

  // Income as one connected wave (area) across the months — viewBox 0..100, stretched to fit.
  const vals = data.map(valueFor)
  const cy = (v: number) => 100 - (v / maxVal) * 100
  const incomePoints = [
    { x: 0, y: cy(vals[0]) },
    ...vals.map((v, i) => ({ x: ((i + 0.5) / vals.length) * 100, y: cy(v) })),
    { x: 100, y: cy(vals[vals.length - 1]) },
  ]
  const incomeArea = `${smoothPath(incomePoints)} L 100,100 L 0,100 Z`

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
        <div className="ml-auto flex items-center gap-1">
          {monthOffset !== 0 && (
            <button
              type="button"
              onClick={() => setMonthOffset(0)}
              className="text-caption font-semibold text-primary hover:underline mr-1"
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={() => setMonthOffset((o) => o - 6)}
            title="Previous 6 months"
            className="bg-bg-white border border-border rounded-full p-1 text-text-muted hover:text-text-heading hover:border-primary transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => setMonthOffset((o) => o + 6)}
            title="Next 6 months"
            className="bg-bg-white border border-border rounded-full p-1 text-text-muted hover:text-text-heading hover:border-primary transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div className="bg-bg-white rounded-lg p-6 shadow-card relative overflow-hidden">
        {/* "FLOW" watermark — decorative */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="font-display leading-none text-[#ebf0f0]" style={{ fontSize: '20rem' }}>FLOW</span>
        </div>

        <div className="relative z-10">
          {/* Continuous "water" backdrop: expense filled + crested, goal as a waterline; income bars rise through it */}
          <div className="relative h-48">
            {/* Expense "water" — continuous, crested */}
            {expense > 0 && <WaveLayer levelPct={(expense / maxVal) * 100} color="rgba(34,182,219,0.16)" />}

            {/* Income — one connected wave across all months (no gutters) */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d={incomeArea} fill="rgba(34,182,219,0.85)" />
            </svg>

            {/* Income goal — waterline */}
            {goal > 0 && <WaveLine levelPct={(goal / maxVal) * 100} color="rgba(34,182,219,0.5)" />}

            {/* Waterline amounts — labeled once, on the left */}
            {goal > 0 && (
              <span className="absolute left-0 z-20 -translate-y-1/2 text-[10px] font-semibold text-[#0e6a86] bg-bg-white/70 rounded px-1 whitespace-nowrap" style={{ bottom: `${(goal / maxVal) * 100}%` }}>
                {formatCurrencyShort(goal)} goal
              </span>
            )}
            {expense > 0 && (
              <span className="absolute left-0 z-20 -translate-y-1/2 text-[10px] font-semibold text-[#0e6a86] bg-bg-white/70 rounded px-1 whitespace-nowrap" style={{ bottom: `${(expense / maxVal) * 100}%` }}>
                {formatCurrencyShort(expense)} expenses
              </span>
            )}

            {/* Per-month overlay: click targets + income value labels (no gutters) */}
            <div className="absolute inset-0 flex">
              {data.map((d) => {
                const val = valueFor(d)
                const periodId = periodByMonth.get(d.month)
                return (
                  <div
                    key={d.month}
                    className={`relative flex-1 h-full ${periodId ? 'cursor-pointer' : ''}`}
                    onClick={periodId ? () => router.push(`/periods/${periodId}`) : undefined}
                    title={periodId ? "Open this month's budget" : undefined}
                  >
                    {val > 0 && (
                      <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1.5 text-[9px] font-bold text-text-heading whitespace-nowrap" style={{ bottom: pct(val) }}>
                        {formatCurrencyShort(val)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex mt-2">
            {data.map((d) => (
              <span key={d.month} className="flex-1 text-center text-caption text-text-muted font-medium">
                {new Date(d.month + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
              </span>
            ))}
          </div>

          {/* Key */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-[10px] text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-income" /> Income ({mode})
            </span>
            {expense > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(34,182,219,0.25)' }} /> Expense need <span className="font-semibold text-text-heading">{formatCurrency(expense)}</span>
              </span>
            )}
            {goal > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: 'rgba(34,182,219,0.6)' }} /> Income goal <span className="font-semibold text-text-heading">{formatCurrency(goal)}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
