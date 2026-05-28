'use client'

import { useMemo, useState } from 'react'
import { Clock, ChevronDown, ChevronRight } from 'lucide-react'
import { formatCurrency, getOwedAmount } from '@/lib/utils'
import { getBudgetedAmount } from '@/lib/calculations'
import type {
  PeriodExpense,
  PeriodAdjustment,
  PeriodManualIncome,
  PeriodExpenseTransfer,
  Invoice,
} from '@/lib/types'

interface LinkedInvoiceRow {
  id: string
  period_id: string
  invoice_id: string
  is_done: boolean
  invoices: Invoice
}

interface ActivityEvent {
  id: string
  ts: number // ms epoch
  kind: 'expense' | 'adjustment' | 'income' | 'invoice' | 'transfer'
  label: string
  /** Current contribution to Amount Left (signed dollar). null if neutral/unknown. */
  impact: number | null
  note?: string
}

function timeAgo(tsMs: number): string {
  const diff = Date.now() - tsMs
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`
  return `${Math.round(diff / 86_400_000)}d ago`
}

/**
 * Recent activity feed for a budget period — last few items touched, sorted by
 * updated_at, with each item's current contribution to Amount Left so the user
 * can read "what made Amount Left land where it is" without a full audit log.
 *
 * Impact rule of thumb (negative = subtracts from Amount Left):
 *   • Pay-now expense / cleared expense → −(its owed amount)
 *   • Adjustment → +amount (already signed)
 *   • Manual income / received invoice → +amount (gross, before deductions)
 *   • Transfer between Pay lines → 0 (zero-sum on totals)
 */
export default function RecentActivity({
  expenses,
  adjustments,
  manualIncome,
  linkedInvoices,
  expenseTransfers,
  limit = 5,
}: {
  expenses: PeriodExpense[]
  adjustments: PeriodAdjustment[]
  manualIncome: PeriodManualIncome[]
  linkedInvoices: LinkedInvoiceRow[]
  expenseTransfers: PeriodExpenseTransfer[]
  limit?: number
}) {
  const [open, setOpen] = useState(false)

  const events = useMemo<ActivityEvent[]>(() => {
    const nameById = new Map(expenses.map((e) => [e.id, e.name]))
    const out: ActivityEvent[] = []

    // Expenses — current pay-now or cleared contribution
    for (const e of expenses) {
      const budgeted = getBudgetedAmount(e)
      const owed = getOwedAmount(e)
      const isCleared = e.is_complete
      // Skip expenses that contribute nothing right now (not pay-now, not cleared)
      if (budgeted === 0 && !isCleared) continue
      const impact = isCleared ? -owed : -budgeted
      const status = isCleared ? 'cleared' : 'pay now'
      out.push({
        id: `e-${e.id}`,
        ts: Date.parse(e.updated_at),
        kind: 'expense',
        label: e.name,
        note: status,
        impact,
      })
    }

    // Adjustments
    for (const a of adjustments) {
      out.push({
        id: `a-${a.id}`,
        ts: Date.parse(a.updated_at ?? a.created_at),
        kind: 'adjustment',
        label: a.note?.trim() || 'Adjustment',
        impact: Number(a.amount) || 0,
      })
    }

    // Manual income (exclude items flagged "Not income / report-only")
    for (const mi of manualIncome) {
      if (mi.exclude_from_reports) continue
      out.push({
        id: `mi-${mi.id}`,
        ts: Date.parse(mi.created_at),
        kind: 'income',
        label: mi.description || 'Manual income',
        note: 'gross',
        impact: Number(mi.amount) || 0,
      })
    }

    // Linked invoices marked received feed actual income; the rest are projected
    for (const li of linkedInvoices) {
      out.push({
        id: `li-${li.id}`,
        ts: Date.parse(li.invoices.updated_at ?? li.invoices.created_at),
        kind: 'invoice',
        label: li.invoices.client_name + (li.invoices.project_name ? ` — ${li.invoices.project_name}` : ''),
        note: li.invoices.status === 'received' ? 'received · gross' : li.invoices.status,
        impact: li.invoices.status === 'received' ? Number(li.invoices.amount) || 0 : null,
      })
    }

    // Fund transfers — zero-sum on totals, but useful to show provenance
    for (const t of expenseTransfers) {
      const fromName = nameById.get(t.from_expense_id) ?? 'a line'
      const toName = nameById.get(t.to_expense_id) ?? 'another line'
      out.push({
        id: `t-${t.id}`,
        ts: Date.parse(t.created_at),
        kind: 'transfer',
        label: `${fromName} → ${toName} · ${formatCurrency(Number(t.amount))}`,
        note: 'zero-sum',
        impact: 0,
      })
    }

    out.sort((a, b) => b.ts - a.ts)
    return out
  }, [expenses, adjustments, manualIncome, linkedInvoices, expenseTransfers])

  const visible = events.slice(0, limit)
  if (events.length === 0) return null

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-muted hover:text-text-heading transition-colors"
        title="See the most recent things that shaped Amount Left"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Clock size={12} />
        <span>Recent activity ({events.length})</span>
      </button>
      {open && (
        <ul className="mt-2 bg-surface-beige rounded-sm p-2.5 space-y-1.5">
          {visible.map((ev) => {
            const impactColor =
              ev.impact == null ? 'text-text-muted' :
              ev.impact > 0 ? 'text-success' :
              ev.impact < 0 ? 'text-warning' : 'text-text-muted'
            const impactStr =
              ev.impact == null ? '·' :
              ev.impact === 0 ? '$0.00' :
              (ev.impact > 0 ? '+' : '−') + formatCurrency(Math.abs(ev.impact)).replace(/^-/, '')
            return (
              <li key={ev.id} className="flex items-center gap-2 text-[11px]">
                <span className={`font-bold tabular-nums w-20 text-right ${impactColor}`}>{impactStr}</span>
                <span className="flex-1 text-text-heading truncate">
                  {ev.label}
                  {ev.note && <span className="text-text-muted"> · {ev.note}</span>}
                </span>
                <span className="text-text-muted shrink-0">{timeAgo(ev.ts)}</span>
              </li>
            )
          })}
          {events.length > visible.length && (
            <li className="text-[10px] text-text-muted text-center pt-1">
              + {events.length - visible.length} earlier
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
