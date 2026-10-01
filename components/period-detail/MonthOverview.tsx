'use client'

import { useOptimistic, useTransition } from 'react'
import { completePeriod, reopenPeriod } from '@/app/actions/periods'
import { notifyError } from '@/lib/toast'
import { formatCurrency, getOwedAmount } from '@/lib/utils'
import { calculatePayNowTotal } from '@/lib/calculations'
import { expensesForSession, sessionLabel, summarizeSession } from '@/lib/sessions'
import type { LinkedInvoiceRow } from '@/lib/sessions'
import type {
  BudgetPeriod,
  BudgetSession,
  PeriodAdjustment,
  PeriodExpense,
  PeriodManualIncome,
  Settings,
} from '@/lib/types'

type BillStatus = 'unfunded' | 'funded' | 'paid' | 'cleared'

const STATUS_STYLE: Record<BillStatus, { label: string; className: string }> = {
  unfunded: { label: 'Not funded', className: 'bg-warning/10 text-warning' },
  funded: { label: 'Funded', className: 'bg-pill-cyan-light text-primary' },
  paid: { label: 'Paid', className: 'bg-pill-peach/60 text-text-heading' },
  cleared: { label: 'Cleared', className: 'bg-surface-mint text-primary-teal' },
}
const STATUS_ORDER: BillStatus[] = ['unfunded', 'funded', 'paid', 'cleared']

const owedOf = (e: PeriodExpense) =>
  e.is_split ? (e.payments ?? []).reduce((s, p) => s + p.amount, 0) : getOwedAmount(e)

/**
 * Month tab — reconciles every session: what came in, what each session set
 * aside and funded, where every bill stands, and whether the month can close.
 */
export default function MonthOverview({
  period,
  sessions,
  expenses,
  manualIncome,
  linkedInvoices,
  adjustments,
  settings,
  onOpenSession,
}: {
  period: BudgetPeriod
  sessions: BudgetSession[]
  expenses: PeriodExpense[]
  manualIncome: PeriodManualIncome[]
  linkedInvoices: LinkedInvoiceRow[]
  adjustments: PeriodAdjustment[]
  settings: Settings
  onOpenSession: (seq: number) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [status, applyStatus] = useOptimistic(period.status, (_s, next: 'active' | 'complete') => next)
  const isLocked = status === 'complete'
  // Event budgets roll up only their own one-time lines, matching the session tabs
  const rollup = period.kind === 'event' ? expenses.filter((e) => e.base_item_id === null) : expenses

  const labelById = new Map(sessions.map((s) => [s.id, sessionLabel(s)]))

  // ─── Per-session rows ─────────────────────────────────────
  const rows = sessions.map((s) => {
    const summary = summarizeSession(s, { manualIncome, linkedInvoices, adjustments }, settings)
    const funded = expensesForSession(rollup, s.id, false)
    const committed = calculatePayNowTotal(funded) + funded.reduce((sum, e) => (e.is_complete ? sum + owedOf(e) : sum), 0)
    return { session: s, ...summary, committed, left: summary.toBudget - committed }
  })
  const totals = rows.reduce(
    (t, r) => ({
      income: t.income + r.income,
      setAside: t.setAside + r.deductions.total,
      committed: t.committed + r.committed,
      left: t.left + r.left,
      tithe: t.tithe + r.deductions.tithe,
      savings: t.savings + r.deductions.savings,
      taxes: t.taxes + r.deductions.taxes,
      profit: t.profit + r.deductions.profit,
      funMoney: t.funMoney + r.deductions.funMoney,
    }),
    { income: 0, setAside: 0, committed: 0, left: 0, tithe: 0, savings: 0, taxes: 0, profit: 0, funMoney: 0 }
  )
  const showDeductions = period.kind !== 'event' || totals.setAside > 0

  // ─── Every bill's status ──────────────────────────────────
  const bills = rollup.map((e) => {
    let billStatus: BillStatus
    let source: string | null
    if (e.is_split) {
      const pays = e.payments ?? []
      const fundedPays = pays.filter((p) => p.session_id)
      billStatus = pays.length > 0 && pays.every((p) => p.cleared) ? 'cleared'
        : fundedPays.length === 0 ? 'unfunded'
        : fundedPays.length === pays.length && fundedPays.every((p) => p.paid) ? 'paid'
        : 'funded'
      const sources = [...new Set(fundedPays.map((p) => labelById.get(p.session_id as string)))].filter(Boolean)
      source = sources.length > 0 ? `${sources.join(', ')} · ${fundedPays.length} of ${pays.length} parts` : null
    } else {
      billStatus = e.is_complete || e.cleared ? 'cleared' : e.paid ? 'paid' : e.session_id ? 'funded' : 'unfunded'
      source = e.session_id ? (labelById.get(e.session_id) ?? null) : null
    }
    return { expense: e, status: billStatus, source, amount: owedOf(e) }
  }).sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.expense.name.localeCompare(b.expense.name))

  const countBy = (st: BillStatus) => bills.filter((b) => b.status === st).length
  const stillToFund = bills.filter((b) => b.status === 'unfunded').reduce((s, b) => s + b.amount, 0)
  const notCleared = bills.length - countBy('cleared')
  const ready = bills.length > 0 && notCleared === 0

  const handleComplete = () => {
    const warning = ready ? '' : `\n\n${notCleared} bill${notCleared === 1 ? ' is' : 's are'} not cleared yet.`
    if (!confirm(`Close ${period.period_name}? Every session locks. You can reopen anytime.${warning}`)) return
    startTransition(async () => {
      applyStatus('complete')
      try { await completePeriod(period.id) }
      catch { notifyError() }
    })
  }
  const handleReopen = () =>
    startTransition(async () => {
      applyStatus('active')
      try { await reopenPeriod(period.id) }
      catch { notifyError() }
    })

  const card = 'bg-bg-white rounded-lg shadow-card p-4 sm:p-6'
  const statLabel = 'text-caption font-bold uppercase text-text-muted'

  return (
    <div className="space-y-6">
      {/* ─── Month totals ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={card}>
          <div className={statLabel}>Income</div>
          <div className="text-h3 font-bold text-text-heading mt-1">{formatCurrency(totals.income)}</div>
          <div className="text-[11px] text-text-muted">{sessions.length} session{sessions.length === 1 ? '' : 's'}</div>
        </div>
        {showDeductions && (
          <div className={card}>
            <div className={statLabel}>Set aside</div>
            <div className="text-h3 font-bold text-text-heading mt-1">{formatCurrency(totals.setAside)}</div>
            <div className="text-[11px] text-text-muted">tithe, savings, tax…</div>
          </div>
        )}
        <div className={card}>
          <div className={statLabel}>Still to fund</div>
          <div className={`text-h3 font-bold mt-1 ${stillToFund > 0 ? 'text-warning' : 'text-success'}`}>{formatCurrency(stillToFund)}</div>
          <div className="text-[11px] text-text-muted">{countBy('unfunded')} bill{countBy('unfunded') === 1 ? '' : 's'}</div>
        </div>
        <div className={card}>
          <div className={statLabel}>Cleared</div>
          <div className="text-h3 font-bold text-text-heading mt-1">{countBy('cleared')} of {bills.length}</div>
          <div className="text-[11px] text-text-muted">bills</div>
        </div>
      </div>

      {/* ─── Sessions ─────────────────────────────────────── */}
      <div className={card}>
        <h2 className="text-h3 font-bold text-text-heading mb-3">Sessions</h2>
        <div className="divide-y divide-divider">
          {rows.map((r) => (
            <button
              key={r.session.id}
              type="button"
              onClick={() => onOpenSession(r.session.seq)}
              className="w-full text-left py-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 hover:bg-bg-cream-light -mx-2 px-2 rounded-sm transition-colors"
            >
              <span className="text-caption font-bold text-text-heading">{sessionLabel(r.session)}</span>
              <span className="text-caption text-text-muted">
                {formatCurrency(r.income)} in
                {showDeductions && <> · {formatCurrency(r.deductions.total)} set aside</>}
                {' '}· {formatCurrency(r.committed)} funded ·{' '}
                <span className={`font-bold ${r.left >= 0 ? 'text-success' : 'text-warning'}`}>{formatCurrency(r.left)} left</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Every bill this month ────────────────────────── */}
      <div className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="text-h3 font-bold text-text-heading">Every bill this month</h2>
          <span className="text-caption text-text-muted">
            {STATUS_ORDER.map((st) => `${countBy(st)} ${STATUS_STYLE[st].label.toLowerCase()}`).join(' · ')}
          </span>
        </div>
        {bills.length === 0 ? (
          <p className="text-caption text-text-muted">No bills in this budget yet.</p>
        ) : (
          <div className="divide-y divide-divider">
            {bills.map(({ expense, status: st, source, amount }) => (
              <div key={expense.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className={`text-caption font-bold truncate ${st === 'cleared' ? 'text-text-muted' : 'text-text-heading'}`}>{expense.name}</div>
                  {source && <div className="text-[11px] text-text-muted truncate">{source}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-caption font-bold text-text-heading">{formatCurrency(amount)}</span>
                  <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${STATUS_STYLE[st].className}`}>{STATUS_STYLE[st].label}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Set aside by session ─────────────────────────── */}
      {showDeductions && totals.setAside > 0 && (
        <div className={card}>
          <h2 className="text-h3 font-bold text-text-heading mb-3">Set aside by session</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-caption min-w-[480px]">
              <thead>
                <tr className="text-text-muted">
                  <th className="text-left font-bold uppercase py-1 pr-3">Session</th>
                  <th className="text-right font-bold uppercase py-1 px-2">Tithe</th>
                  <th className="text-right font-bold uppercase py-1 px-2">Savings</th>
                  <th className="text-right font-bold uppercase py-1 px-2">Tax</th>
                  <th className="text-right font-bold uppercase py-1 px-2">Profit</th>
                  <th className="text-right font-bold uppercase py-1 px-2">Giving</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.session.id} className="border-t border-border/50">
                    <td className="py-1.5 pr-3 text-text-heading font-medium whitespace-nowrap">{sessionLabel(r.session)}</td>
                    <td className="text-right py-1.5 px-2">{formatCurrency(r.deductions.tithe)}</td>
                    <td className="text-right py-1.5 px-2">{formatCurrency(r.deductions.savings)}</td>
                    <td className="text-right py-1.5 px-2">{formatCurrency(r.deductions.taxes)}</td>
                    <td className="text-right py-1.5 px-2">{formatCurrency(r.deductions.profit)}</td>
                    <td className="text-right py-1.5 px-2">{formatCurrency(r.deductions.funMoney)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold text-text-heading">
                  <td className="py-1.5 pr-3 uppercase text-text-muted text-[10px]">Month</td>
                  <td className="text-right py-1.5 px-2">{formatCurrency(totals.tithe)}</td>
                  <td className="text-right py-1.5 px-2">{formatCurrency(totals.savings)}</td>
                  <td className="text-right py-1.5 px-2">{formatCurrency(totals.taxes)}</td>
                  <td className="text-right py-1.5 px-2">{formatCurrency(totals.profit)}</td>
                  <td className="text-right py-1.5 px-2">{formatCurrency(totals.funMoney)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ─── Close the month ──────────────────────────────── */}
      <div className={`${card} flex flex-wrap items-center justify-between gap-4 ${isLocked ? 'bg-success/10 border border-success/30' : ''}`}>
        <div>
          <div className="text-caption font-bold text-text-heading">
            {isLocked ? '🔒 Month closed' : ready ? 'Ready to close' : 'Not ready to close yet'}
          </div>
          <div className="text-caption text-text-muted mt-0.5">
            {isLocked
              ? `Every session is locked${period.completed_at ? ` since ${new Date(period.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}.`
              : ready
                ? 'Every bill is funded and cleared.'
                : `${countBy('unfunded')} not funded · ${notCleared} not cleared`}
          </div>
        </div>
        {isLocked ? (
          <button
            onClick={handleReopen}
            disabled={isPending}
            className="bg-bg-white text-text-heading border border-border rounded-full px-4 py-1.5 text-caption font-bold hover:border-primary disabled:opacity-50 transition-colors"
          >
            Reopen
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={isPending}
            className={`rounded-full px-4 py-1.5 text-caption font-bold disabled:opacity-50 transition-opacity ${
              ready ? 'bg-primary-teal text-text-inverse hover:opacity-90' : 'bg-surface-beige text-text-heading hover:opacity-80'
            }`}
          >
            Close month
          </button>
        )}
      </div>
    </div>
  )
}
