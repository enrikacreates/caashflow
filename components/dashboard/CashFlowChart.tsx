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

// A steady repeating wave top-edge that oscillates ±amp around yLine, so its average IS the waterline.
function waveTop(yLine: number, amp: number, crests: number, width = 1200): string {
  const seg = width / (crests * 2)
  let d = `M 0,${yLine}`
  for (let i = 0; i < crests * 2; i++) {
    const x0 = i * seg
    const x1 = x0 + seg
    const peakY = yLine + (i % 2 === 0 ? -amp : amp) // crest, then trough, repeating
    const cx = x0 + seg / 2
    d += ` C ${cx},${peakY} ${cx},${peakY} ${x1},${yLine}`
  }
  return d
}

/** Translucent "water" filled to `levelPct`; its surface is a steady wave averaging to the waterline. */
function WaveLayer({ levelPct, color, amp = 5, crests = 3 }: { levelPct: number; color: string; amp?: number; crests?: number }) {
  const yLine = 100 - levelPct
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${waveTop(yLine, amp, crests)} L 1200,100 L 0,100 Z`} fill={color} />
    </svg>
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
  // small headroom so the top wave crest has room without clipping
  const maxVal = Math.max(...data.map(valueFor), goal, expense, 1) * 1.07
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
            {/* Income goal "water" — back layer; steady wave, average = the goal waterline */}
            {goal > 0 && <WaveLayer levelPct={(goal / maxVal) * 100} color="rgba(34,182,219,0.12)" crests={3} amp={5} />}

            {/* Expense need "water" — front layer (overlaps goal, no gap); a tighter wave variant */}
            {expense > 0 && <WaveLayer levelPct={(expense / maxVal) * 100} color="rgba(34,182,219,0.18)" crests={4} amp={4} />}

            {/* Income — one connected wave across all months (no gutters) */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d={incomeArea} fill="rgba(34,182,219,0.85)" />
            </svg>

            {/* Waterline amounts — stacked top-left, no chip, each tinted in its wave's blue */}
            {(goal > 0 || expense > 0) && (
              <div className="absolute -top-3 left-0 z-20 flex flex-col gap-0 text-[10px] font-bold leading-tight">
                {goal > 0 && <span className="whitespace-nowrap text-income">{formatCurrencyShort(goal)} goal</span>}
                {expense > 0 && <span className="whitespace-nowrap" style={{ color: '#0E7C9C' }}>{formatCurrencyShort(expense)} expenses</span>}
              </div>
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
                    <span className={`absolute left-1/2 -translate-x-1/2 -translate-y-1.5 text-[9px] font-bold whitespace-nowrap ${val > 0 ? 'text-text-heading' : 'text-text-muted'}`} style={{ bottom: pct(val) }}>
                      {formatCurrencyShort(val)}
                    </span>
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
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(34,182,219,0.12)' }} /> Income goal <span className="font-semibold text-text-heading">{formatCurrency(goal)}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
