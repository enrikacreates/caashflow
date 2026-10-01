'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { Pencil, Plus } from 'lucide-react'
import PeriodDetailClient from '@/components/period-detail/PeriodDetailClient'
import MonthOverview from '@/components/period-detail/MonthOverview'
import { startNewSession, updateSession, removeEmptySession } from '@/app/actions/sessions'
import { notifyError } from '@/lib/toast'
import { expensesForSession, localToday, sessionLabel } from '@/lib/sessions'
import type { LinkedInvoiceRow } from '@/lib/sessions'
import type {
  Account,
  BudgetPeriod,
  BudgetRequest,
  BudgetSession,
  Invoice,
  PeriodAdjustment,
  PeriodExpense,
  PeriodExpenseTransfer,
  PeriodManualIncome,
  PeriodSavingsAllocation,
  PriorityCategoryRecord,
  SavingsGoal,
  Settings,
} from '@/lib/types'

interface Props {
  period: BudgetPeriod
  sessions: BudgetSession[]
  expenses: PeriodExpense[]
  linkedInvoices: LinkedInvoiceRow[]
  manualIncome: PeriodManualIncome[]
  linkableInvoices: Invoice[]
  settings: Settings
  accounts: Account[]
  adjustments: PeriodAdjustment[]
  expenseTransfers: PeriodExpenseTransfer[]
  categories: PriorityCategoryRecord[]
  savingsGoals: SavingsGoal[]
  savingsAllocations: PeriodSavingsAllocation[]
  lastPeriodAllocations: PeriodSavingsAllocation[]
  requests: BudgetRequest[]
  accountTransfers: { session_id: string | null; account_name: string; transferred: boolean; cash_done: boolean }[]
  // ?s= from the URL: a session seq, or "month"
  initialTab?: string
}

type Tab = number | 'month'

/**
 * A budget month worked in sessions — one tab per budgeting sitting (whatever
 * money landed), plus a Month tab that reconciles them all.
 */
export default function PeriodSessions(props: Props) {
  const { period } = props
  const [, startTransition] = useTransition()
  // Session changes show instantly; the server catches up on revalidate
  const [sessions, applySessionOpt] = useOptimistic(
    props.sessions,
    (state: BudgetSession[], u: { kind: 'add'; session: BudgetSession } | { kind: 'remove'; id: string } | { kind: 'patch'; id: string; name: string | null; session_date: string }) => {
      if (u.kind === 'add') return [...state, u.session]
      if (u.kind === 'remove') return state.filter((s) => s.id !== u.id)
      return state.map((s) => (s.id === u.id ? { ...s, name: u.name, session_date: u.session_date } : s))
    }
  )
  const newest = sessions[sessions.length - 1]
  // A session still being created has a temporary id; its tab shows but can't be worked yet
  const isSaving = (s: BudgetSession) => s.id.startsWith('tmp-')

  const parseTab = (raw?: string): Tab => {
    if (raw === 'month') return 'month'
    const seq = Number(raw)
    return sessions.some((s) => s.seq === seq) ? seq : newest.seq
  }
  // Tab lives in component state only. Rewriting the URL here (history.replaceState)
  // desyncs the Next router, which then drops the refreshed data after a save.
  // Incoming links can still open a tab with ?s=<seq> or ?s=month.
  const [tab, setTab] = useState<Tab>(() => parseTab(props.initialTab))
  // A just-created session arrives on the next render — fall back to newest until then
  const active = tab === 'month' ? null : (sessions.find((s) => s.seq === tab) ?? newest)


  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftDate, setDraftDate] = useState('')

  const isLocked = period.status === 'complete'

  const handleStartSession = () => {
    if (isSaving(newest)) return
    if (!confirm('Start a new session?\n\nUse this when new money lands. Bills you already funded stay with their session; unfunded bills move along to the new one.')) return
    const seq = newest.seq + 1
    const now = new Date().toISOString()
    setTab(seq)
    setEditing(false)
    startTransition(async () => {
      applySessionOpt({
        kind: 'add',
        session: {
          ...newest,
          id: `tmp-${seq}`,
          seq,
          name: null,
          session_date: localToday(),
          deduction_paid: {},
          created_at: now,
          updated_at: now,
        },
      })
      try {
        await startNewSession(period.id, localToday())
      } catch {
        setTab(newest.seq)
        notifyError('Could not start a new session. Please try again.')
      }
    })
  }

  const openEditor = (s: BudgetSession) => {
    setDraftName(s.name ?? '')
    setDraftDate(s.session_date)
    setEditing(true)
  }

  const handleSaveSession = (s: BudgetSession) => {
    const name = draftName.trim() || null
    const session_date = draftDate || s.session_date
    setEditing(false)
    startTransition(async () => {
      applySessionOpt({ kind: 'patch', id: s.id, name, session_date })
      try {
        await updateSession(s.id, period.id, { name, session_date })
      } catch {
        notifyError('Could not save the session. Please try again.')
      }
    })
  }

  const handleRemoveSession = (s: BudgetSession) => {
    if (!confirm(`Remove ${sessionLabel(s)}? It has no income or bills yet.`)) return
    setTab(sessions[sessions.length - 2].seq)
    setEditing(false)
    startTransition(async () => {
      applySessionOpt({ kind: 'remove', id: s.id })
      try {
        await removeEmptySession(s.id, period.id)
      } catch (err) {
        notifyError(err instanceof Error ? err.message : 'Could not remove the session.')
      }
    })
  }

  // Newest session can be removed only while it's empty (undo a mis-tap)
  const newestIsEmpty =
    sessions.length > 1 &&
    !props.manualIncome.some((mi) => mi.session_id === newest.id) &&
    !props.linkedInvoices.some((li) => li.session_id === newest.id) &&
    !props.adjustments.some((a) => a.session_id === newest.id) &&
    !props.expenses.some((e) => e.session_id === newest.id || (e.payments ?? []).some((p) => p.session_id === newest.id))

  const tabClass = (on: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-caption font-bold transition-colors ${
      on ? 'bg-primary-teal text-text-inverse' : 'bg-bg-white text-text-muted shadow-card hover:text-text-heading'
    }`

  return (
    <div className="space-y-6">
      {/* ─── Session tabs ─────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Budget sessions">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={tab === s.seq}
              onClick={() => { setTab(s.seq); setEditing(false) }}
              className={tabClass(tab === s.seq)}
            >
              {sessionLabel(s)}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'month'}
            onClick={() => { setTab('month'); setEditing(false) }}
            className={tabClass(tab === 'month')}
          >
            Month
          </button>
          {!isLocked && (
            <button
              type="button"
              onClick={handleStartSession}
              disabled={isSaving(newest)}
              title="Start a new session when new money lands"
              className="shrink-0 inline-flex items-center gap-1 rounded-full border border-dashed border-primary-teal text-primary-teal px-3 py-1.5 text-caption font-bold hover:bg-primary-teal/10 disabled:opacity-50 transition-colors"
            >
              <Plus size={14} /> New session
            </button>
          )}
        </div>

        {/* Active session: name/date editor */}
        {active && !editing && !isSaving(active) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-muted">
            <span>
              {active.id === newest.id
                ? 'Newest session. Bills you check to Pay are funded from this income.'
                : 'Earlier session. Clear its bills here as they go through.'}
            </span>
            {!isLocked && (
              <button
                type="button"
                onClick={() => openEditor(active)}
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              >
                <Pencil size={12} /> Rename
              </button>
            )}
            {!isLocked && active.id === newest.id && newestIsEmpty && (
              <button
                type="button"
                onClick={() => handleRemoveSession(active)}
                className="font-semibold text-warning hover:underline"
              >
                Remove session
              </button>
            )}
          </div>
        )}
        {active && editing && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleSaveSession(active) }}
            className="flex flex-wrap items-end gap-2 bg-bg-white rounded-lg shadow-card p-3"
          >
            <label className="text-caption font-bold text-text-muted">
              Date
              <input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                className="block mt-1 bg-bg-white border border-border rounded-sm px-2 py-1 text-caption text-text-heading focus:outline-none focus:border-primary"
              />
            </label>
            <label className="text-caption font-bold text-text-muted flex-1 min-w-[140px]">
              Name
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder={`S${active.seq}`}
                maxLength={40}
                className="block w-full mt-1 bg-bg-white border border-border rounded-sm px-2 py-1 text-caption text-text-heading focus:outline-none focus:border-primary"
              />
            </label>
            <button
              type="submit"
              className="bg-primary-teal text-text-inverse rounded-full px-4 py-1.5 text-caption font-bold hover:opacity-90"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-caption font-semibold text-text-muted hover:text-text-heading px-2 py-1.5"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {active && isSaving(active) ? (
        <div className="bg-bg-white rounded-lg shadow-card p-6 flex items-center gap-3 text-caption text-text-muted">
          <span className="inline-block w-4 h-4 border-2 border-primary-teal/30 border-t-primary-teal rounded-full animate-spin" />
          Setting up {sessionLabel(active)}…
        </div>
      ) : active ? (
        <PeriodDetailClient
          // Remount per session so optimistic state and local edits never leak across tabs
          key={active.id}
          period={period}
          session={active}
          isNewestSession={active.id === newest.id}
          monthLinkedInvoiceIds={props.linkedInvoices.map((li) => li.invoice_id)}
          expenses={expensesForSession(props.expenses, active.id, active.id === newest.id)}
          linkedInvoices={props.linkedInvoices.filter((li) => li.session_id === active.id)}
          manualIncome={props.manualIncome.filter((mi) => mi.session_id === active.id)}
          linkableInvoices={props.linkableInvoices}
          settings={props.settings}
          accounts={props.accounts}
          adjustments={props.adjustments.filter((a) => a.session_id === active.id)}
          expenseTransfers={props.expenseTransfers}
          categories={props.categories}
          savingsGoals={props.savingsGoals}
          savingsAllocations={props.savingsAllocations}
          lastPeriodAllocations={props.lastPeriodAllocations}
          requests={props.requests}
          accountTransfersDone={props.accountTransfers
            .filter((t) => t.session_id === active.id && t.transferred)
            .map((t) => t.account_name)}
          accountsCashDone={props.accountTransfers
            .filter((t) => t.session_id === active.id && t.cash_done)
            .map((t) => t.account_name)}
        />
      ) : (
        <MonthOverview
          period={period}
          sessions={sessions}
          expenses={props.expenses}
          manualIncome={props.manualIncome}
          linkedInvoices={props.linkedInvoices}
          adjustments={props.adjustments}
          settings={props.settings}
          onOpenSession={(seq) => setTab(seq)}
        />
      )}
    </div>
  )
}
