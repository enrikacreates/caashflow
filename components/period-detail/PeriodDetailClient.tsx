'use client'

import { useState, useTransition, useCallback, useRef, useEffect, useOptimistic } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateExpenseField,
  markExpensePaid,
  updateDeductionOverrides,
  linkInvoiceToPeriod,
  unlinkInvoiceFromPeriod,
  addManualIncome,
  removeManualIncome,
  recalculatePeriodIncome,
  toggleExpenseSplit,
  toggleExpenseOverdue,
  setExpenseCleared,
  bulkMarkPaid,
  settleAndResetPeriod,
  addExpensePayment,
  updateExpensePayment,
  removeExpensePayment,
  toggleManualIncomeDone,
  toggleLinkedInvoiceDone,
  addAdjustment,
  removeAdjustment,
  addOneTimeExpense,
  removePeriodExpense,
  setAccountTransferDone,
} from '@/app/actions/period-expenses'
import { completePeriod, reopenPeriod } from '@/app/actions/periods'
import { smallConfetti, bigConfetti } from '@/lib/confetti'
import { formatCurrency, getOwedAmount, getPriorityPill } from '@/lib/utils'
import { calculateDeductions, calculatePayNowTotal, calculateAccountTransferDetail, getDeductionAccountAllocations, getBudgetedAmount, isFullyPaid, calculatePeriodPaymentSummary } from '@/lib/calculations'
import type { DeductionMode } from '@/lib/calculations'
import SavingsAllocationSection from '@/components/period-detail/SavingsAllocationSection'
import PeriodRequestsPanel from '@/components/period-detail/PeriodRequestsPanel'
import PeriodExpenseEditModal from '@/components/period-detail/PeriodExpenseEditModal'
import type {
  BudgetPeriod,
  PeriodExpense,
  PeriodExpensePayment,
  Invoice,
  PeriodManualIncome,
  Settings,
  DeductionOverrides,
  PriorityCategoryRecord,
  SavingsGoal,
  PeriodSavingsAllocation,
  PeriodDeductionContribution,
  PeriodAdjustment,
  Account,
  BudgetRequest,
} from '@/lib/types'

type SortKey = 'name' | 'default_amount' | 'priority_category' | 'account' | 'due_day' | 'frequency'
type SortDir = 'asc' | 'desc'

/** Compact priority label — "P1: Essentials" → "P1" (keeps the table narrow). */
function priorityCode(name: string): string {
  const m = name.match(/p\s*\d+/i)
  return (m ? m[0] : name.split(':')[0]).replace(/\s+/g, '').toUpperCase().slice(0, 3)
}

interface LinkedInvoiceRow {
  id: string
  period_id: string
  invoice_id: string
  is_done: boolean
  invoices: Invoice
}

interface Props {
  period: BudgetPeriod
  expenses: PeriodExpense[]
  linkedInvoices: LinkedInvoiceRow[]
  manualIncome: PeriodManualIncome[]
  allReceivedInvoices: Invoice[]
  settings: Settings
  accounts: Account[]
  deductionContributions: PeriodDeductionContribution[]
  adjustments: PeriodAdjustment[]
  categories: PriorityCategoryRecord[]
  savingsGoals: SavingsGoal[]
  savingsAllocations: PeriodSavingsAllocation[]
  lastPeriodAllocations: PeriodSavingsAllocation[]
  requests: BudgetRequest[]
  accountTransfersDone: string[]
}

export default function PeriodDetailClient({
  period,
  expenses,
  linkedInvoices,
  manualIncome,
  allReceivedInvoices,
  settings,
  accounts,
  deductionContributions,
  adjustments,
  categories,
  savingsGoals,
  savingsAllocations,
  lastPeriodAllocations,
  requests,
  accountTransfersDone,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Build a lookup map: category name → color_key
  const categoryColorMap = new Map(categories.map(c => [c.name, c.color_key]))
  const [sortKey, setSortKey] = useState<SortKey>('priority_category')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [showInvoiceSelector, setShowInvoiceSelector] = useState(false)
  const [showManualIncomeForm, setShowManualIncomeForm] = useState(false)
  const [showOneTimeForm, setShowOneTimeForm] = useState(false)
  const [editExpense, setEditExpense] = useState<PeriodExpense | null>(null)
  // Collapsible sections — open by default; a key set true means collapsed.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const isOpen = (k: string) => !collapsed[k]
  const toggleSection = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }))
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})
  const summaryCardsRef = useRef<HTMLDivElement>(null)
  const [showStickyBar, setShowStickyBar] = useState(false)

  // Adjustment capture slot (one at a time; the captured list lives in the ledger below)
  const [capMode, setCapMode] = useState<'flat' | 'target'>('flat')
  const [capAmount, setCapAmount] = useState('')
  const [capNote, setCapNote] = useState('')
  const [justCaptured, setJustCaptured] = useState(false)

  // ─── Optimistic overlays — toggles flip instantly; server reconciles on revalidate ──
  const [optExpenses, applyExpenseOpt] = useOptimistic(
    expenses,
    (
      state: PeriodExpense[],
      u:
        | { kind: 'field'; id: string; field: string; value: boolean | number | null }
        | { kind: 'payment'; id: string; field: string; value: boolean }
        | { kind: 'remove'; id: string }
    ) => {
      if (u.kind === 'remove') return state.filter((e) => e.id !== u.id)
      if (u.kind === 'field') return state.map((e) => (e.id === u.id ? { ...e, [u.field]: u.value } : e))
      return state.map((e) => ({
        ...e,
        payments: (e.payments ?? []).map((p) => (p.id === u.id ? { ...p, [u.field]: u.value } : p)),
      }))
    }
  )
  const [optLinked, applyLinkedOpt] = useOptimistic(
    linkedInvoices,
    (state: LinkedInvoiceRow[], u: { id: string; value: boolean }) =>
      state.map((li) => (li.id === u.id ? { ...li, is_done: u.value } : li))
  )
  const [optManual, applyManualOpt] = useOptimistic(
    manualIncome,
    (state: PeriodManualIncome[], u: { id: string; value: boolean }) =>
      state.map((mi) => (mi.id === u.id ? { ...mi, is_done: u.value } : mi))
  )
  // Optimistic overlay for deduction overrides — %/$ edits recompute the numbers instantly
  const [overridesLocal, setOverridesLocal] = useState<DeductionOverrides>(period.deduction_overrides ?? {})

  // Which account transfers are marked done — flips instantly, server reconciles
  const [doneTransfers, applyTransferOpt] = useOptimistic(
    new Set(accountTransfersDone),
    (state: Set<string>, u: { account: string; done: boolean }) => {
      const next = new Set(state)
      if (u.done) next.add(u.account)
      else next.delete(u.account)
      return next
    }
  )
  const handleToggleTransfer = (account: string, done: boolean) =>
    startTransition(async () => {
      applyTransferOpt({ account, done })
      await setAccountTransferDone(period.id, account, done)
    })

  useEffect(() => {
    const el = summaryCardsRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // ─── Calculations ────────────────────────────────────────────
  const deductions = calculateDeductions(
    period.income_amount,
    settings,
    overridesLocal
  )
  const payNowTotal = calculatePayNowTotal(optExpenses)
  const deductionAccountAllocations = getDeductionAccountAllocations(deductions, settings)
  const accountTransfers = calculateAccountTransferDetail(optExpenses, deductionAccountAllocations)
  // Adjustments reduce/raise what's left to budget — deductions stay on the full check
  const adjustment = adjustments.reduce((sum, a) => sum + (a.amount || 0), 0)
  const availableToBudget = deductions.incomeAfterDeductions + adjustment
  const amountLeft = availableToBudget - payNowTotal
  const paymentSummary = calculatePeriodPaymentSummary(optExpenses)
  const isLocked = period.status === 'complete'

  // Income split: active drives the math; settled (done) is sealed but still shown
  const settledIncome =
    optLinked
      .filter((li) => li.is_done && li.invoices.status === 'received')
      .reduce((s, li) => s + li.invoices.amount, 0) +
    optManual.filter((mi) => mi.is_done).reduce((s, mi) => s + mi.amount, 0)
  const activeIncome = period.income_amount
  const receivedIncome = activeIncome + settledIncome

  // Deductions ledger — cumulative contributions logged as income was settled
  const ledgerTotals = deductionContributions.reduce(
    (acc, c) => {
      acc.tithe += c.tithe
      acc.savings += c.savings
      acc.tax += c.tax
      acc.profit += c.profit
      acc.fun_money += c.fun_money
      acc.grand += c.tithe + c.savings + c.tax + c.profit + c.fun_money
      return acc
    },
    { tithe: 0, savings: 0, tax: 0, profit: 0, fun_money: 0, grand: 0 }
  )

  // Linked invoice IDs for filtering the selector
  const linkedInvoiceIds = new Set(linkedInvoices.map((li) => li.invoice_id))

  // ─── Sort ────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedExpenses = [...optExpenses].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    const aVal = a[sortKey] ?? ''
    const bVal = b[sortKey] ?? ''
    if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * mul
    return String(aVal).localeCompare(String(bVal)) * mul
  })

  // Baseline (from settings) vs one-time (ad-hoc, this period only)
  const baselineExpenses = sortedExpenses.filter((e) => e.base_item_id !== null)
  const oneTimeExpenses = sortedExpenses.filter((e) => e.base_item_id === null)
  const baselinePayNow = calculatePayNowTotal(baselineExpenses)
  const oneTimePayNow = calculatePayNowTotal(oneTimeExpenses)

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 text-[10px] opacity-50">
      {sortKey === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  )

  // ─── Field Updates (Debounced) ───────────────────────────────
  const debouncedUpdate = useCallback(
    (expenseId: string, field: string, value: boolean | number | string | null) => {
      const key = `${expenseId}-${field}`
      if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
      debounceTimers.current[key] = setTimeout(() => {
        startTransition(() => updateExpenseField(expenseId, field, value))
      }, 300)
    },
    [startTransition]
  )

  const handleCheckboxChange = (expenseId: string, field: string, value: boolean) => {
    if (field === 'paid' && value === true) {
      const expense = optExpenses.find((e) => e.id === expenseId)
      if (expense?.debt_id || expense?.savings_goal_id) {
        startTransition(async () => {
          applyExpenseOpt({ kind: 'field', id: expenseId, field, value })
          const { exceedsMinimum, savingsExceedsMonthly, savingsAchieved } =
            await markExpensePaid(expenseId)
          if (savingsAchieved) {
            await bigConfetti()
          } else if (exceedsMinimum || savingsExceedsMonthly) {
            await smallConfetti()
          }
        })
        return
      }
    }
    startTransition(async () => {
      applyExpenseOpt({ kind: 'field', id: expenseId, field, value })
      await updateExpenseField(expenseId, field, value)
    })
  }

  // ─── Income ──────────────────────────────────────────────────
  const handleLinkInvoice = (invoiceId: string) => {
    startTransition(async () => {
      await linkInvoiceToPeriod(period.id, invoiceId)
      await recalculatePeriodIncome(period.id)
    })
  }

  const handleUnlinkInvoice = (invoiceId: string) => {
    startTransition(async () => {
      await unlinkInvoiceFromPeriod(period.id, invoiceId)
      await recalculatePeriodIncome(period.id)
    })
  }

  const handleAddManualIncome = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const description = formData.get('description') as string
    const amount = parseFloat(formData.get('amount') as string)
    if (!description || isNaN(amount)) return
    startTransition(async () => {
      await addManualIncome(period.id, description, amount)
      await recalculatePeriodIncome(period.id)
      setShowManualIncomeForm(false)
    })
  }

  const handleRemoveManualIncome = (id: string) => {
    startTransition(async () => {
      await removeManualIncome(id)
      await recalculatePeriodIncome(period.id)
    })
  }

  const handleToggleManualIncomeDone = (id: string, value: boolean) =>
    startTransition(async () => {
      applyManualOpt({ id, value })
      await toggleManualIncomeDone(id, period.id, value)
    })

  const handleToggleLinkedInvoiceDone = (linkId: string, value: boolean) =>
    startTransition(async () => {
      applyLinkedOpt({ id: linkId, value })
      await toggleLinkedInvoiceDone(linkId, period.id, value)
    })

  // ─── Deductions ──────────────────────────────────────────────
  const handleDeductionChange = (key: string, value: string) => {
    const parsed = value === '' ? null : parseFloat(value)
    // optimistic: recompute deductions instantly (mirror server's null = reset-to-default)
    setOverridesLocal((prev) => {
      const merged: Record<string, number | null> = { ...prev, [key]: parsed }
      if (parsed === null) delete merged[key]
      return merged as DeductionOverrides
    })
    const timerKey = `deduction-${key}`
    if (debounceTimers.current[timerKey]) clearTimeout(debounceTimers.current[timerKey])
    debounceTimers.current[timerKey] = setTimeout(() => {
      startTransition(() => updateDeductionOverrides(period.id, { [key]: parsed }))
    }, 500)
  }

  const handleDeductionModeToggle = (
    pctKey: string,
    amtKey: string,
    detail: { amount: number; mode: DeductionMode; percentage: number },
    newMode: DeductionMode
  ) => {
    if (detail.mode === newMode) return
    const updates: Record<string, number | null> = {}
    if (newMode === '$') {
      updates[amtKey] = Math.round(detail.amount * 100) / 100
      updates[pctKey] = null
    } else {
      updates[pctKey] = Math.round(detail.percentage * 10) / 10
      updates[amtKey] = null
    }
    // optimistic: flip the mode + value instantly
    setOverridesLocal((prev) => {
      const merged: Record<string, number | null> = { ...prev, ...updates }
      for (const k of Object.keys(merged)) if (merged[k] == null) delete merged[k]
      return merged as DeductionOverrides
    })
    startTransition(() => updateDeductionOverrides(period.id, updates))
  }

  // ─── Adjustments ─────────────────────────────────────────────
  // flat = the entered amount is the adjustment; target = entered amount is the desired
  // "left to budget", and we back-solve the adjustment off the current available figure
  const resolvedAdjAmount =
    capAmount === '' || isNaN(parseFloat(capAmount))
      ? null
      : capMode === 'flat'
        ? Math.round(parseFloat(capAmount) * 100) / 100
        : Math.round((parseFloat(capAmount) - availableToBudget) * 100) / 100

  const canCapture = resolvedAdjAmount !== null && resolvedAdjAmount !== 0 && !justCaptured

  const handleCaptureAdjustment = () => {
    if (!canCapture || resolvedAdjAmount === null) return
    setJustCaptured(true)
    startTransition(() => addAdjustment(period.id, resolvedAdjAmount, capNote.trim() || null))
  }

  const handleAdjModeToggle = (mode: 'flat' | 'target') => {
    if (mode === capMode) return
    setCapMode(mode)
    setCapAmount('')
    setJustCaptured(false)
  }

  const handleRemoveAdjustment = (id: string) => startTransition(() => removeAdjustment(id, period.id))

  // ─── One-time expenses ───────────────────────────────────────
  const handleAddOneTime = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const name = (fd.get('name') as string)?.trim()
    const amount = parseFloat(fd.get('amount') as string)
    if (!name || isNaN(amount)) return
    const dueRaw = fd.get('due') as string
    startTransition(async () => {
      await addOneTimeExpense(period.id, {
        name,
        default_amount: amount,
        account: (fd.get('account') as string) || null,
        priority_category: (fd.get('priority') as string) || null,
        due_day: dueRaw ? parseInt(dueRaw, 10) : null,
      })
      setShowOneTimeForm(false)
    })
  }

  const handleRemoveOneTime = (id: string) => {
    startTransition(async () => {
      applyExpenseOpt({ kind: 'remove', id })
      await removePeriodExpense(id, period.id)
    })
  }

  // ─── Split / sub-payments / complete ─────────────────────────
  const handleToggleSplit = (id: string, value: boolean) =>
    startTransition(() => toggleExpenseSplit(id, period.id, value))

  // "Clear" is the terminal settle: drop from the live balance + seal the line.
  const handleToggleCleared = (id: string, value: boolean) =>
    startTransition(async () => {
      applyExpenseOpt({ kind: 'field', id, field: 'cleared', value })
      applyExpenseOpt({ kind: 'field', id, field: 'is_complete', value })
      if (value) applyExpenseOpt({ kind: 'field', id, field: 'pay_now', value: false })
      await setExpenseCleared(id, period.id, value)
    })

  const handleToggleOverdue = (id: string, value: boolean) => {
    const exp = optExpenses.find((e) => e.id === id)
    startTransition(async () => {
      applyExpenseOpt({ kind: 'field', id, field: 'is_overdue', value })
      if (value && exp && !exp.is_split) {
        applyExpenseOpt({ kind: 'field', id, field: 'pay_now', value: true })
        applyExpenseOpt({ kind: 'field', id, field: 'amount_override', value: exp.default_amount * 2 })
      } else if (!value) {
        applyExpenseOpt({ kind: 'field', id, field: 'amount_override', value: null })
        applyExpenseOpt({ kind: 'field', id, field: 'pay_now', value: false })
      }
      await toggleExpenseOverdue(id, period.id, value)
    })
  }

  const handleAddPayment = (id: string) =>
    startTransition(() => addExpensePayment(id, period.id))

  const handleRemovePayment = (paymentId: string) =>
    startTransition(() => removeExpensePayment(paymentId, period.id))

  const debouncedPaymentUpdate = useCallback(
    (paymentId: string, field: string, value: string | number | boolean | null) => {
      const key = `pay-${paymentId}-${field}`
      if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
      debounceTimers.current[key] = setTimeout(() => {
        startTransition(async () => {
          await updateExpensePayment(paymentId, period.id, { [field]: value })
        })
      }, 400)
    },
    [period.id]
  )

  const handlePaymentToggle = (paymentId: string, field: string, value: boolean) => {
    startTransition(async () => {
      applyExpenseOpt({ kind: 'payment', id: paymentId, field, value })
      const res = await updateExpensePayment(paymentId, period.id, { [field]: value })
      if (field === 'paid') {
        if (res.savingsAchieved) await bigConfetti()
        else if (res.exceedsMinimum || res.savingsExceedsMonthly) await smallConfetti()
      }
    })
  }

  // Clearing a partial settles just that installment — drops it from the live balance (like Clear on a single bill).
  const handlePaymentCleared = (paymentId: string, value: boolean) =>
    startTransition(async () => {
      applyExpenseOpt({ kind: 'payment', id: paymentId, field: 'cleared', value })
      applyExpenseOpt({ kind: 'payment', id: paymentId, field: 'pay_now', value: !value })
      await updateExpensePayment(paymentId, period.id, { cleared: value, pay_now: !value })
    })

  // ─── Bulk header actions (scoped to to-pay items) ───────────
  const handleBulkPaid = () => {
    if (!confirm('Mark all to-pay items as paid?')) return
    startTransition(async () => { await bulkMarkPaid(period.id) })
  }
  const handleSettleReset = () => {
    if (!confirm('Clear all PAID items and reset for the next check?\n\nSettles & locks every paid item, logs the active income to the ledger, and clears adjustments. Unpaid items stay live. Nothing is deleted — reopen any row individually.')) return
    startTransition(async () => { await settleAndResetPeriod(period.id) })
  }

  // ─── Budget complete / reopen ────────────────────────────────
  const handleComplete = () => {
    if (!confirm('Mark this budget complete? It will lock for editing — you can reopen it anytime.')) return
    startTransition(() => completePeriod(period.id))
  }
  const handleReopen = () => startTransition(() => reopenPeriod(period.id))

  const inputClass = 'bg-bg-white border border-border rounded-sm px-2 py-1 text-caption focus:outline-none focus:border-primary transition-colors'
  const thClass = 'text-left text-caption font-bold uppercase text-text-muted px-3 py-3 whitespace-nowrap cursor-pointer hover:text-text-heading select-none'

  return (
    <div className="space-y-8">
      {/* Background-save indicator — reassures during the server round-trip */}
      {isPending && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-text-heading text-white text-caption font-bold px-3 py-1.5 rounded-full shadow-card">
          <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          Saving…
        </div>
      )}

      {/* ─── Status bar: complete / reopen ─────────────────── */}
      <div className={`flex items-center justify-between gap-4 rounded-lg px-5 py-3 ${isLocked ? 'bg-success/10 border border-success/30' : 'bg-bg-white shadow-card'}`}>
        <div className="flex items-center gap-2">
          {isLocked ? (
            <>
              <span className="text-success font-bold text-caption uppercase tracking-wide">🔒 Complete</span>
              <span className="text-caption text-text-muted">This budget is sealed{period.completed_at ? ` — ${new Date(period.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}.</span>
            </>
          ) : (
            <>
              <span className="text-primary-teal font-bold text-caption uppercase tracking-wide">● Active</span>
              <span className="text-caption text-text-muted">Still working bills in this budget.</span>
            </>
          )}
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
            className="bg-primary-teal text-text-inverse rounded-full px-4 py-1.5 text-caption font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Mark Complete
          </button>
        )}
      </div>

      {/* ─── Summary Cards ─────────────────────────────────── */}
      <div ref={summaryCardsRef} className="bg-bg-white rounded-lg shadow-card p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-4 sm:divide-x sm:divide-border/60">
          <div className="@container sm:px-3 first:pl-0">
            <div className="text-caption font-bold uppercase text-text-muted mb-1">Total Income</div>
            <div className="font-bold text-text-heading whitespace-nowrap leading-tight text-[clamp(0.78rem,15cqi,1.5rem)]">{formatCurrency(period.income_amount)}</div>
          </div>
          <div className="@container sm:px-3">
            <div className="text-caption font-bold uppercase text-text-muted mb-1">To Budget</div>
            <div className="font-bold text-text-heading whitespace-nowrap leading-tight text-[clamp(0.78rem,15cqi,1.5rem)]">{formatCurrency(deductions.incomeAfterDeductions)}</div>
          </div>
          <div className="@container sm:px-3">
            <div className="text-caption font-bold uppercase text-text-muted mb-1">Pay Now</div>
            <div className="font-bold text-text-heading whitespace-nowrap leading-tight text-[clamp(0.78rem,15cqi,1.5rem)]">{formatCurrency(payNowTotal)}</div>
          </div>
          <div className="@container sm:px-3">
            <div className="text-caption font-bold uppercase text-text-muted mb-1">Amount Left</div>
            <div className={`font-bold whitespace-nowrap leading-tight text-[clamp(0.78rem,15cqi,1.5rem)] ${amountLeft >= 0 ? 'text-success' : 'text-warning'}`}>
              {formatCurrency(amountLeft)}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Sticky Summary Bar (visible when scrolled past cards) ── */}
      {showStickyBar && (
        <div className="sticky top-0 z-40 -mx-6 px-6 -mt-4">
          <div className="bg-white/90 backdrop-blur-sm rounded-b-lg shadow-card px-4 py-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-caption">
              <span className="text-text-muted">Income <span className="font-bold text-text-heading">{formatCurrency(period.income_amount)}</span></span>
              <span className="text-text-muted hidden sm:inline">To Budget <span className="font-bold text-text-heading">{formatCurrency(deductions.incomeAfterDeductions)}</span></span>
              <span className="text-text-muted">Pay Now <span className="font-bold text-text-heading">{formatCurrency(payNowTotal)}</span></span>
            </div>
            <div className={`text-label font-bold ${amountLeft >= 0 ? 'text-success' : 'text-warning'}`}>
              {formatCurrency(amountLeft)} left
            </div>
          </div>
        </div>
      )}

      {/* ─── Account Transfers (overview — stays visible as it draws down) ── */}
      {Object.keys(accountTransfers).length > 0 && (
        <div className="bg-bg-white rounded-lg shadow-card p-4 sm:p-5">
          <h2 className="text-h3 font-bold text-text-heading">
            <button
              type="button"
              onClick={() => toggleSection('transfers')}
              className="inline-flex items-center gap-2 hover:text-primary transition-colors"
            >
              <span className="text-text-muted text-base leading-none">{isOpen('transfers') ? '▾' : '▸'}</span>
              Account Transfers
            </button>
          </h2>
          {isOpen('transfers') && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-4 mt-4 sm:divide-x sm:divide-border/60">
              {Object.entries(accountTransfers).map(([account, detail]) => {
                const done = doneTransfers.has(account)
                // Keep the zero-based starting amount visible until this account's expenses all clear
                const showStarted = detail.expenseRemaining > 0
                return (
                  <div key={account} className="@container sm:px-3 first:pl-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <button
                        type="button"
                        onClick={() => handleToggleTransfer(account, !done)}
                        disabled={isLocked}
                        title={done ? 'Transfer completed — tap to undo' : 'Mark this transfer as completed'}
                        className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center text-[9px] leading-none transition-colors disabled:opacity-50 ${
                          done ? 'bg-success border-success text-text-inverse' : 'border-border text-transparent hover:border-primary'
                        }`}
                      >
                        ✓
                      </button>
                      <span className="text-caption font-bold uppercase text-text-muted truncate">{account}</span>
                    </div>
                    <div className={`font-bold whitespace-nowrap leading-tight text-[clamp(0.78rem,15cqi,1.5rem)] ${done ? 'text-success' : 'text-text-heading'}`}>
                      {formatCurrency(detail.remaining)}
                    </div>
                    {showStarted && (
                      <div className="text-[10px] text-text-muted/80 whitespace-nowrap">started {formatCurrency(detail.original)}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Income Section ────────────────────────────────── */}
      <div className="bg-bg-white rounded-lg shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h3 font-bold text-text-heading">
            <button type="button" onClick={() => toggleSection('income')} className="inline-flex items-center gap-2 hover:text-primary transition-colors">
              <span className="text-text-muted text-base leading-none">{isOpen('income') ? '▾' : '▸'}</span>
              Income
            </button>
          </h2>
          {isOpen('income') && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowInvoiceSelector(!showInvoiceSelector)}
              disabled={isLocked}
              className="bg-primary-teal text-text-inverse rounded-full px-4 py-1.5 text-caption font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              Link Invoice
            </button>
            <button
              onClick={() => setShowManualIncomeForm(!showManualIncomeForm)}
              disabled={isLocked}
              className="bg-bg-white text-text-heading border border-border rounded-full px-4 py-1.5 text-caption font-bold hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              + Manual
            </button>
          </div>
          )}
        </div>
        {isOpen('income') && (<>

        {/* Linked Invoices */}
        {optLinked.length > 0 && (
          <div className="mb-4">
            <div className="text-caption font-bold text-text-muted uppercase mb-2">Linked Invoices</div>
            <div className="space-y-2">
              {optLinked.map((li) => (
                <div key={li.id} className={`flex items-center justify-between bg-[#ebf0f0] rounded-sm px-4 py-2 ${li.is_done ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-caption font-bold text-text-heading">{li.invoices.client_name}</span>
                    {li.invoices.project_name && (
                      <span className="text-caption text-text-muted">– {li.invoices.project_name}</span>
                    )}
                    {li.is_done && (
                      <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-bold uppercase">Budgeted</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-caption font-bold text-text-heading">{formatCurrency(li.invoices.amount)}</span>
                    <span
                      className="flex items-center gap-1 text-caption text-text-muted cursor-help"
                      title="Budgeted out: this income's deductions are logged to the period ledger and it's removed from the active income total (so new income calculates its own tithe/savings/tax)."
                    >
                      <input
                        type="checkbox"
                        checked={li.is_done}
                        disabled={isLocked || isPending}
                        onChange={(e) => handleToggleLinkedInvoiceDone(li.id, e.target.checked)}
                        className="rounded"
                      />
                      Budgeted
                    </span>
                    {!li.is_done && (
                      <button
                        onClick={() => handleUnlinkInvoice(li.invoice_id)}
                        disabled={isPending || isLocked}
                        className="text-caption text-warning font-semibold hover:underline disabled:opacity-50"
                      >
                        Unlink
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Income */}
        {optManual.length > 0 && (
          <div className="mb-4">
            <div className="text-caption font-bold text-text-muted uppercase mb-2">Manual Income</div>
            <div className="space-y-2">
              {optManual.map((mi) => (
                <div key={mi.id} className={`flex items-center justify-between bg-[#ebf0f0] rounded-sm px-4 py-2 ${mi.is_done ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-caption font-bold text-text-heading">{mi.description}</span>
                    {mi.is_done && (
                      <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-bold uppercase">Budgeted</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-caption font-bold text-text-heading">{formatCurrency(mi.amount)}</span>
                    <span
                      className="flex items-center gap-1 text-caption text-text-muted cursor-help"
                      title="Budgeted out: this income's deductions are logged to the period ledger and it's removed from the active income total (so new income calculates its own tithe/savings/tax)."
                    >
                      <input
                        type="checkbox"
                        checked={mi.is_done}
                        disabled={isLocked || isPending}
                        onChange={(e) => handleToggleManualIncomeDone(mi.id, e.target.checked)}
                        className="rounded"
                      />
                      Budgeted
                    </span>
                    {!mi.is_done && (
                      <button
                        onClick={() => handleRemoveManualIncome(mi.id)}
                        disabled={isPending || isLocked}
                        className="text-caption text-warning font-semibold hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invoice Selector Dropdown */}
        {showInvoiceSelector && (
          <div className="bg-surface-beige rounded-sm p-4 mb-4">
            <div className="text-caption font-bold text-text-muted uppercase mb-2">Select Received Invoices to Link</div>
            {allReceivedInvoices.filter((inv) => !linkedInvoiceIds.has(inv.id)).length === 0 ? (
              <p className="text-caption text-text-muted">No unlinked received invoices available.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {allReceivedInvoices
                  .filter((inv) => !linkedInvoiceIds.has(inv.id))
                  .map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between py-1">
                      <label className="flex items-center gap-2 text-caption cursor-pointer">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) handleLinkInvoice(inv.id)
                          }}
                          className="rounded"
                        />
                        <span className="font-medium text-text-heading">{inv.client_name}</span>
                        {inv.project_name && <span className="text-text-muted">– {inv.project_name}</span>}
                      </label>
                      <span className="text-caption font-bold text-text-heading">{formatCurrency(inv.amount)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Manual Income Form */}
        {showManualIncomeForm && (
          <form onSubmit={handleAddManualIncome} className="flex gap-2 items-end bg-surface-beige rounded-sm p-4">
            <div className="flex-1">
              <label className="block text-caption font-bold text-text-muted mb-1">Description</label>
              <input type="text" name="description" required placeholder="e.g., Side project" className={inputClass + ' w-full'} />
            </div>
            <div className="w-32">
              <label className="block text-caption font-bold text-text-muted mb-1">Amount</label>
              <input type="number" name="amount" step="0.01" required placeholder="0.00" className={inputClass + ' w-full'} />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="bg-primary-teal text-text-inverse rounded-full px-4 py-1.5 text-caption font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Add
            </button>
          </form>
        )}

        <div className="text-right mt-3 pt-3 border-t border-border">
          <span className="text-caption text-text-muted">{settledIncome > 0 ? 'Active Income: ' : 'Total Income: '}</span>
          <span className="text-h3 font-bold text-text-heading">{formatCurrency(activeIncome)}</span>
          {settledIncome > 0 && (
            <div className="text-caption text-text-muted mt-1">
              Received {formatCurrency(receivedIncome)} · budgeted {formatCurrency(settledIncome)} (excluded from active math)
            </div>
          )}
        </div>
        </>)}
      </div>

      {/* ─── Deductions Grid ───────────────────────────────── */}
      <div className="bg-bg-white rounded-lg shadow-card p-6">
        <h2 className="text-h3 font-bold text-text-heading mb-4">
          <button type="button" onClick={() => toggleSection('deductions')} className="inline-flex items-center gap-2 hover:text-primary transition-colors">
            <span className="text-text-muted text-base leading-none">{isOpen('deductions') ? '▾' : '▸'}</span>
            Deductions
          </button>
        </h2>
        {isOpen('deductions') && (<>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-4">
          {([
            { pctKey: 'tithe_percentage', amtKey: 'tithe_amount', label: 'Tithe', detail: deductions.details.titheD, accountKey: 'tithe_account' },
            { pctKey: 'savings_percentage', amtKey: 'savings_amount', label: 'Savings', detail: deductions.details.savingsD, accountKey: 'savings_account' },
            { pctKey: 'tax_percentage', amtKey: 'tax_amount', label: 'Tax', detail: deductions.details.taxD, accountKey: 'tax_account' },
            { pctKey: 'profit_percentage', amtKey: 'profit_amount', label: 'Profit', detail: deductions.details.profitD, accountKey: 'profit_account' },
            { pctKey: 'fun_money_percentage', amtKey: 'fun_money_amount', label: 'Fun Money', detail: deductions.details.funMoneyD, accountKey: 'fun_money_account' },
          ] as const).map(({ pctKey, amtKey, label, detail, accountKey }) => {
            const hasOverride =
              overridesLocal?.[pctKey as keyof DeductionOverrides] !== undefined ||
              overridesLocal?.[amtKey as keyof DeductionOverrides] !== undefined
            return (
              <div key={pctKey} className="text-center">
                <div className="text-caption font-bold text-text-muted uppercase mb-1">{label}</div>
                {/* % | $ toggle */}
                <div className="flex justify-center mb-1">
                  <div className="flex rounded-full overflow-hidden bg-surface-beige">
                    <button
                      onClick={() => handleDeductionModeToggle(pctKey, amtKey, detail, '%')}
                      disabled={isLocked}
                      className={`px-2 py-0.5 text-[10px] font-bold transition-colors disabled:opacity-50 ${
                        detail.mode === '%' ? 'bg-text-heading text-white' : 'text-text-muted hover:text-text-heading'
                      }`}
                    >
                      %
                    </button>
                    <button
                      onClick={() => handleDeductionModeToggle(pctKey, amtKey, detail, '$')}
                      disabled={isLocked}
                      className={`px-2 py-0.5 text-[10px] font-bold transition-colors disabled:opacity-50 ${
                        detail.mode === '$' ? 'bg-text-heading text-white' : 'text-text-muted hover:text-text-heading'
                      }`}
                    >
                      $
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <input
                    type="number"
                    step={detail.mode === '%' ? '0.1' : '0.01'}
                    key={`${pctKey}-${detail.mode}`}
                    defaultValue={detail.value}
                    disabled={isLocked}
                    onChange={(e) => handleDeductionChange(
                      detail.mode === '%' ? pctKey : amtKey,
                      e.target.value
                    )}
                    className={`w-20 text-center text-caption font-bold rounded-sm border px-2 py-1 focus:outline-none focus:border-primary disabled:opacity-60 ${
                      hasOverride ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  />
                  <span className="text-caption text-text-muted">{detail.mode === '%' ? '%' : '$'}</span>
                </div>
                {detail.mode === '%' ? (
                  <div className="text-caption font-bold text-text-heading">{formatCurrency(detail.amount)}</div>
                ) : (
                  <div className="text-[10px] text-text-muted">= {detail.percentage.toFixed(1)}%</div>
                )}
                {/* Destination account — set in Settings, feeds Account Transfers */}
                <div className="mt-1.5 text-[10px] text-text-muted truncate" title={settings[accountKey] ?? 'No account set'}>
                  {settings[accountKey] ? `→ ${settings[accountKey]}` : '→ no account'}
                </div>
              </div>
            )
          })}

          {/* Adjustment capture — one at a time; captured list lives in the ledger below */}
          <div className="text-center">
            <div className="text-caption font-bold text-text-muted uppercase mb-1">Adjustment</div>
            {/* flat (±) | target (set desired left) toggle */}
            <div className="flex justify-center mb-1">
              <div className="flex rounded-full overflow-hidden bg-surface-beige">
                <button
                  onClick={() => handleAdjModeToggle('flat')}
                  disabled={isLocked}
                  title="Flat: enter a +/− amount"
                  className={`px-2 py-0.5 text-[10px] font-bold transition-colors disabled:opacity-50 ${capMode === 'flat' ? 'bg-text-heading text-white' : 'text-text-muted hover:text-text-heading'}`}
                >
                  ±
                </button>
                <button
                  onClick={() => handleAdjModeToggle('target')}
                  disabled={isLocked}
                  title="Target: enter the amount you want left and it calculates the adjustment"
                  className={`px-2 py-0.5 text-[10px] font-bold transition-colors disabled:opacity-50 ${capMode === 'target' ? 'bg-text-heading text-white' : 'text-text-muted hover:text-text-heading'}`}
                >
                  left=
                </button>
              </div>
            </div>
            <input
              type="number"
              step="0.01"
              value={capAmount}
              placeholder={capMode === 'flat' ? '-20' : String(Math.round(availableToBudget))}
              disabled={isLocked}
              onChange={(e) => { setCapAmount(e.target.value); setJustCaptured(false) }}
              className="block mx-auto w-20 text-center text-caption font-bold rounded-sm border border-border px-2 py-1 focus:outline-none focus:border-primary disabled:opacity-60"
            />
            <input
              type="text"
              value={capNote}
              placeholder="note"
              disabled={isLocked}
              onChange={(e) => { setCapNote(e.target.value); setJustCaptured(false) }}
              className="block mx-auto w-20 text-[10px] text-center rounded-sm border border-border px-1.5 py-1 mt-1 focus:outline-none focus:border-primary disabled:opacity-60"
            />
            {capMode === 'target' && resolvedAdjAmount !== null && (
              <div className="text-[10px] text-text-muted mt-1">adj {formatCurrency(resolvedAdjAmount)}</div>
            )}
            {!isLocked && (
              <div className="flex items-center justify-center gap-1.5 mt-1.5">
                <button
                  onClick={handleCaptureAdjustment}
                  disabled={!canCapture}
                  className="text-[10px] text-primary font-bold hover:underline disabled:opacity-40 disabled:cursor-default"
                >
                  + Add
                </button>
                {justCaptured && (
                  <span className="text-success text-[10px] font-bold" title="Captured to the ledger below">✓</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-between items-start pt-4 border-t border-border gap-2 flex-wrap">
          <div>
            <span className="text-caption text-text-muted">Total Deductions: </span>
            <span className="font-bold text-text-heading">{formatCurrency(deductions.total)}</span>
          </div>
          <div className="text-right">
            <span className="text-caption text-text-muted">After Deductions: </span>
            <span className="font-bold text-text-heading">{formatCurrency(deductions.incomeAfterDeductions)}</span>
            {adjustment !== 0 && (
              <div className="text-caption text-text-muted mt-0.5">
                Available to budget: <span className="font-bold text-text-heading">{formatCurrency(availableToBudget)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Adjustments ledger — captured fees / pre-budget spends (shows when there's one) */}
        {adjustments.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-caption font-bold uppercase text-text-muted tracking-wide">Adjustments</h3>
              <span className="text-caption text-text-muted">
                Net <span className={`font-bold ${adjustment < 0 ? 'text-warning' : 'text-text-heading'}`}>{formatCurrency(adjustment)}</span>
              </span>
            </div>
            <div className="space-y-1.5">
              {adjustments.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-caption">
                  <span className="text-text-heading truncate pr-2">
                    {a.note || <span className="text-text-muted italic">no note</span>}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`font-bold ${a.amount < 0 ? 'text-warning' : 'text-text-heading'}`}>{formatCurrency(a.amount)}</span>
                    {!isLocked && (
                      <button onClick={() => handleRemoveAdjustment(a.id)} disabled={isPending} className="text-text-muted hover:text-warning text-[10px] disabled:opacity-50">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ledger — cumulative deductions logged as income was settled */}
        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-caption font-bold uppercase text-text-muted tracking-wide">Set Aside This Period</h3>
            {deductionContributions.length > 0 && (
              <span className="text-caption text-text-muted">Total <span className="font-bold text-text-heading">{formatCurrency(ledgerTotals.grand)}</span></span>
            )}
          </div>
          {deductionContributions.length === 0 ? (
            <p className="text-caption text-text-muted">
              Nothing set aside yet. As you mark income <span className="font-semibold">Done</span>, its tithe / savings / tax / profit / fun money get logged here and totaled for the period.
            </p>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-caption">
                <thead>
                  <tr className="text-text-muted">
                    <th className="text-left font-bold uppercase py-1 pr-3">Source</th>
                    <th className="text-right font-bold uppercase py-1 px-2">Tithe</th>
                    <th className="text-right font-bold uppercase py-1 px-2">Savings</th>
                    <th className="text-right font-bold uppercase py-1 px-2">Tax</th>
                    <th className="text-right font-bold uppercase py-1 px-2">Profit</th>
                    <th className="text-right font-bold uppercase py-1 px-2">Fun</th>
                  </tr>
                </thead>
                <tbody>
                  {deductionContributions.map((c) => (
                    <tr key={c.id} className="border-t border-border/50">
                      <td className="py-1.5 pr-3 text-text-heading font-medium">
                        {c.source_label || (c.source_kind === 'invoice' ? 'Invoice' : 'Manual income')}
                        <span className="text-text-muted font-normal"> · {formatCurrency(c.income_amount)}</span>
                      </td>
                      <td className="text-right py-1.5 px-2">{formatCurrency(c.tithe)}</td>
                      <td className="text-right py-1.5 px-2">{formatCurrency(c.savings)}</td>
                      <td className="text-right py-1.5 px-2">{formatCurrency(c.tax)}</td>
                      <td className="text-right py-1.5 px-2">{formatCurrency(c.profit)}</td>
                      <td className="text-right py-1.5 px-2">{formatCurrency(c.fun_money)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-bold text-text-heading">
                    <td className="py-1.5 pr-3 uppercase text-text-muted text-[10px]">Period total</td>
                    <td className="text-right py-1.5 px-2">{formatCurrency(ledgerTotals.tithe)}</td>
                    <td className="text-right py-1.5 px-2">{formatCurrency(ledgerTotals.savings)}</td>
                    <td className="text-right py-1.5 px-2">{formatCurrency(ledgerTotals.tax)}</td>
                    <td className="text-right py-1.5 px-2">{formatCurrency(ledgerTotals.profit)}</td>
                    <td className="text-right py-1.5 px-2">{formatCurrency(ledgerTotals.fun_money)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-[10px] text-text-muted mt-2">
              Logged automatically as income is marked done. The grid above sets rates for active income; this is your cumulative set-aside for the period.
            </p>
            </>
          )}
        </div>
        </>)}
      </div>

      {/* ─── Savings Allocation ────────────────────────────── */}
      {savingsGoals.length > 0 && (
        <SavingsAllocationSection
          periodId={period.id}
          savingsPool={deductions.savings}
          leftoverBudget={amountLeft}
          savingsGoals={savingsGoals}
          savingsAllocations={savingsAllocations}
          lastPeriodAllocations={lastPeriodAllocations}
          locked={isLocked}
        />
      )}

      {/* ─── Expenses Table ────────────────────────────────── */}
      <div className="bg-bg-white rounded-lg shadow-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
          <h2 className="text-h3 font-bold text-text-heading">
            <button
              type="button"
              onClick={() => toggleSection('expenses')}
              className="inline-flex items-center gap-2 hover:text-primary transition-colors"
              title={isOpen('expenses') ? 'Collapse expenses' : 'Expand expenses'}
            >
              <span className="text-text-muted text-base leading-none">{isOpen('expenses') ? '▾' : '▸'}</span>
              Expenses
            </button>
            <span className="text-caption font-medium text-text-muted ml-2">
              ({baselineExpenses.filter((e) => getBudgetedAmount(e) > 0).length} marked pay now)
            </span>
          </h2>
          {/* Payment rollup — accounts for partial / split payments */}
          <div className="flex items-center gap-3 text-caption">
            <span className="text-text-muted">Budgeted <span className="font-bold text-text-heading">{formatCurrency(paymentSummary.budgeted)}</span></span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">Paid <span className="font-bold text-success">{formatCurrency(paymentSummary.paid)}</span></span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted"><span className="font-bold text-text-heading">{paymentSummary.scheduledBills}</span> {paymentSummary.scheduledBills === 1 ? 'bill' : 'bills'} scheduled</span>
          </div>
        </div>

        {isOpen('expenses') && (
        <div className="rounded-lg overflow-auto max-h-[70vh]">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-bg-white [&>th]:sticky [&>th]:top-0 [&>th]:z-20 [&>th]:bg-bg-white [&>th]:border-b [&>th]:border-[#e9e9e9]">
                  <th className="text-center px-3 py-3 text-caption font-bold uppercase text-text-muted w-10">Pay</th>
                  <th className={thClass} onClick={() => handleSort('name')}>
                    Name<SortIcon col="name" />
                  </th>
                  <th className={thClass} onClick={() => handleSort('default_amount')}>
                    Amount<SortIcon col="default_amount" />
                  </th>
                  <th className={`${thClass} w-[1%]`} onClick={() => handleSort('account')}>
                    Acct<SortIcon col="account" />
                  </th>
                  <th className={`${thClass} w-[1%]`} onClick={() => handleSort('priority_category')}>
                    Pri<SortIcon col="priority_category" />
                  </th>
                  <th className={`${thClass} w-[1%]`} onClick={() => handleSort('due_day')}>
                    Due<SortIcon col="due_day" />
                  </th>
                  <th className="text-center px-3 py-3">
                    <button type="button" onClick={handleBulkPaid} disabled={isLocked} title="Mark all to-pay items paid" className="text-caption font-bold uppercase text-text-muted hover:text-primary transition-colors disabled:opacity-50">Paid</button>
                  </th>
                  <th className="text-center px-3 py-3">
                    <button type="button" onClick={handleSettleReset} disabled={isLocked} title="Clear all paid items & reset income — zeroes the budget for the next check (unpaid items stay live)" className="text-[10px] font-bold uppercase bg-primary-teal/10 text-primary rounded-full px-2.5 py-1 hover:bg-primary-teal/20 transition-colors disabled:opacity-50">Clear</button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {baselineExpenses.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    isPending={isPending}
                    isLocked={isLocked}
                    onCheckboxChange={handleCheckboxChange}
                    onDebouncedUpdate={debouncedUpdate}
                    onToggleSplit={handleToggleSplit}
                    onToggleOverdue={handleToggleOverdue}
                    onToggleCleared={handleToggleCleared}
                    onAddPayment={handleAddPayment}
                    onPaymentField={debouncedPaymentUpdate}
                    onPaymentToggle={handlePaymentToggle}
                    onPaymentCleared={handlePaymentCleared}
                    onRemovePayment={handleRemovePayment}
                    onEdit={setEditExpense}
                    inputClass={inputClass}
                    categoryColorMap={categoryColorMap}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-bg-white">
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 font-bold text-text-heading text-caption">Pay Now</td>
                  <td className="px-3 py-3 font-bold text-text-heading text-caption">{formatCurrency(baselinePayNow)}</td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            </table>
        </div>
        )}
      </div>

      {/* ─── One-Time Expenses (ad-hoc, this budget only) ──── */}
      <div className="bg-bg-white rounded-lg shadow-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-h3 font-bold text-text-heading">
            <button type="button" onClick={() => toggleSection('extra')} className="inline-flex items-center gap-2 hover:text-primary transition-colors">
              <span className="text-text-muted text-base leading-none">{isOpen('extra') ? '▾' : '▸'}</span>
              Extra Expenses
            </button>
            <span className="text-caption font-medium text-text-muted ml-2">(this budget only)</span>
          </h2>
          {isOpen('extra') && !isLocked && (
            <button
              onClick={() => setShowOneTimeForm(!showOneTimeForm)}
              className="bg-primary-teal text-text-inverse rounded-full px-4 py-1.5 text-caption font-bold hover:opacity-90 transition-opacity"
            >
              + Add extra expense
            </button>
          )}
        </div>
        {isOpen('extra') && (<>

        {showOneTimeForm && !isLocked && (
          <form onSubmit={handleAddOneTime} className="flex flex-wrap gap-3 items-end bg-surface-beige rounded-sm p-4 mb-4">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-caption font-bold text-text-muted mb-1">Name</label>
              <input type="text" name="name" required placeholder="e.g., Car deep clean" className={inputClass + ' w-full'} />
            </div>
            <div className="w-28">
              <label className="block text-caption font-bold text-text-muted mb-1">Amount</label>
              <input type="number" name="amount" step="0.01" required placeholder="0.00" className={inputClass + ' w-full'} />
            </div>
            <div className="w-36">
              <label className="block text-caption font-bold text-text-muted mb-1">Account</label>
              <select name="account" className={inputClass + ' w-full'}>
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="w-36">
              <label className="block text-caption font-bold text-text-muted mb-1">Priority</label>
              <select name="priority" className={inputClass + ' w-full'}>
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="w-20">
              <label className="block text-caption font-bold text-text-muted mb-1">Due day</label>
              <input type="number" name="due" min="1" max="31" placeholder="—" className={inputClass + ' w-full'} />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="bg-primary-teal text-text-inverse rounded-full px-4 py-1.5 text-caption font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Add
            </button>
          </form>
        )}

        {oneTimeExpenses.length === 0 ? (
          <div className="bg-bg-white rounded-lg shadow-card p-5 text-caption text-text-muted">
            No extra expenses yet. Add ad-hoc costs that apply to <span className="font-semibold">this budget only</span> — they won&apos;t touch your settings baseline.
          </div>
        ) : (
          <div className="rounded-lg overflow-auto max-h-[70vh]">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-bg-white [&>th]:sticky [&>th]:top-0 [&>th]:z-20 [&>th]:bg-bg-white [&>th]:border-b [&>th]:border-[#e9e9e9]">
                    <th className="text-center px-3 py-3 text-caption font-bold uppercase text-text-muted w-10">Pay</th>
                    <th className="text-left px-3 py-3 text-caption font-bold uppercase text-text-muted">Name</th>
                    <th className="text-left px-3 py-3 text-caption font-bold uppercase text-text-muted">Amount</th>
                    <th className="text-left px-2 py-3 text-caption font-bold uppercase text-text-muted w-[1%]">Acct</th>
                    <th className="text-left px-2 py-3 text-caption font-bold uppercase text-text-muted w-[1%]">Pri</th>
                    <th className="text-left px-2 py-3 text-caption font-bold uppercase text-text-muted w-[1%]">Due</th>
                    <th className="text-center px-3 py-3 text-caption font-bold uppercase text-text-muted">Paid</th>
                    <th className="text-center px-3 py-3 text-caption font-bold uppercase text-text-muted">Clear</th>
                    <th className="text-center px-3 py-3 text-caption font-bold uppercase text-text-muted">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {oneTimeExpenses.map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      isPending={isPending}
                      isLocked={isLocked}
                      onCheckboxChange={handleCheckboxChange}
                      onDebouncedUpdate={debouncedUpdate}
                      onToggleSplit={handleToggleSplit}
                      onToggleOverdue={handleToggleOverdue}
                      onToggleCleared={handleToggleCleared}
                      onAddPayment={handleAddPayment}
                      onPaymentField={debouncedPaymentUpdate}
                      onPaymentToggle={handlePaymentToggle}
                      onPaymentCleared={handlePaymentCleared}
                      onRemovePayment={handleRemovePayment}
                      onRemove={handleRemoveOneTime}
                      onEdit={setEditExpense}
                      inputClass={inputClass}
                      categoryColorMap={categoryColorMap}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-bg-white">
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 font-bold text-text-heading text-caption">Pay Now</td>
                    <td className="px-3 py-3 font-bold text-text-heading text-caption">{formatCurrency(oneTimePayNow)}</td>
                    <td colSpan={6} />
                  </tr>
                </tfoot>
              </table>
          </div>
        )}
        </>)}
      </div>

      {/* ─── Requests (wish list → pull into this budget) ──── */}
      <PeriodRequestsPanel requests={requests} periodId={period.id} isLocked={isLocked} />

      {/* ─── In-place expense editor (stays on this budget) ── */}
      {editExpense && (
        <PeriodExpenseEditModal
          expense={editExpense}
          accounts={accounts}
          categories={categories}
          onClose={() => setEditExpense(null)}
        />
      )}

      {/* ─── Back Button ───────────────────────────────────── */}
      <div className="pt-4">
        <button
          onClick={() => router.push('/periods')}
          className="text-caption text-primary font-semibold hover:underline"
        >
          ← Back to Periods
        </button>
      </div>
    </div>
  )
}

// ─── Expense Row Component ───────────────────────────────────────
function ExpenseRow({
  expense,
  isPending,
  isLocked,
  onCheckboxChange,
  onDebouncedUpdate,
  onToggleSplit,
  onToggleOverdue,
  onToggleCleared,
  onAddPayment,
  onPaymentField,
  onPaymentToggle,
  onPaymentCleared,
  onRemovePayment,
  onRemove,
  onEdit,
  inputClass,
  categoryColorMap,
}: {
  expense: PeriodExpense
  isPending: boolean
  isLocked: boolean
  onCheckboxChange: (id: string, field: string, value: boolean) => void
  onDebouncedUpdate: (id: string, field: string, value: boolean | number | string | null) => void
  onToggleSplit: (id: string, value: boolean) => void
  onToggleOverdue: (id: string, value: boolean) => void
  onToggleCleared: (id: string, value: boolean) => void
  onAddPayment: (id: string) => void
  onPaymentField: (paymentId: string, field: string, value: string | number | boolean | null) => void
  onPaymentToggle: (paymentId: string, field: string, value: boolean) => void
  onPaymentCleared: (paymentId: string, value: boolean) => void
  onRemovePayment: (paymentId: string) => void
  onRemove?: (id: string) => void
  onEdit?: (expense: PeriodExpense) => void
  inputClass: string
  categoryColorMap: Map<string, string>
}) {
  const hasOverride = expense.amount_override !== null && expense.amount_override !== undefined
  const [amountInput, setAmountInput] = useState(
    hasOverride ? String(expense.amount_override) : String(expense.default_amount)
  )

  const payments = expense.payments ?? []
  const budgeted = getBudgetedAmount(expense)
  const owed = getOwedAmount(expense)
  const fullyPaid = isFullyPaid(expense)
  const settled = fullyPaid || expense.is_complete

  // When split, the parent's Pay/Paid/Clear are derived (read-only) from its sub-payments
  const splitPayNow = expense.is_split && payments.length > 0 && payments.some((p) => p.pay_now)
  const splitCleared = expense.is_split && payments.length > 0 && payments.every((p) => p.cleared)

  // Row is read-only when the budget is locked OR the line is marked complete
  const rowDisabled = isLocked || expense.is_complete

  // Unified table palette: grey-green zebra (white / #ebf0f0) + warm blush hover (#f2e9e9)
  const rowBg = budgeted > 0
    ? 'bg-primary-teal/[0.15] hover:bg-[#f2e9e9]'
    : 'odd:bg-bg-white even:bg-[#ebf0f0] hover:bg-[#f2e9e9]'

  const handleOverdueClick = () => {
    const next = !expense.is_overdue
    // Non-split bills auto-double (last month + this month); the figure stays editable
    if (!expense.is_split) {
      setAmountInput(next ? String(expense.default_amount * 2) : String(expense.default_amount))
    }
    onToggleOverdue(expense.id, next)
  }

  return (
    <>
      <tr className={`transition-colors ${rowBg} ${settled ? 'opacity-60' : ''}`}>
        {/* PayNow */}
        <td className="text-center px-3 py-3">
          <input
            type="checkbox"
            checked={expense.is_split ? splitPayNow : expense.pay_now}
            onChange={(e) => onCheckboxChange(expense.id, 'pay_now', e.target.checked)}
            disabled={expense.is_split || rowDisabled}
            className="rounded"
          />
        </td>

        {/* Name */}
        <td className="px-3 py-3">
          {!rowDisabled && (
            <button
              type="button"
              onClick={handleOverdueClick}
              title={expense.is_overdue ? 'Clear past-due flag' : 'Mark past due — carried from a prior period (doubles the amount)'}
              className={`block text-[10px] font-semibold mb-0.5 transition-colors hover:text-warning ${
                expense.is_overdue ? 'text-warning' : 'text-text-muted/50'
              }`}
            >
              {expense.is_overdue ? 'Past due ✕' : 'Past due?'}
            </button>
          )}
          <span className="inline-flex items-center gap-1 flex-wrap">
            {expense.is_overdue && <span title="Overdue — carried from a prior period">🚩</span>}
            {onEdit && !rowDisabled ? (
              <button
                type="button"
                onClick={() => onEdit(expense)}
                title="Edit this expense"
                className="text-caption font-medium text-text-heading hover:text-primary hover:underline transition-colors text-left"
              >
                {expense.name}
              </button>
            ) : (
              <span className="text-caption font-medium text-text-heading">{expense.name}</span>
            )}
            {expense.auto_pay && (
              <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-bold">AUTO</span>
            )}
            {expense.pay_url && (
              <a
                href={expense.pay_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-primary ml-1 font-bold hover:underline"
              >
                PAY →
              </a>
            )}
          </span>
        </td>

        {/* Amount (flexible, with split toggle + rollup) */}
        <td className="px-3 py-3">
          <input
            type="number"
            step="0.01"
            value={amountInput}
            disabled={rowDisabled}
            onChange={(e) => {
              const raw = e.target.value
              setAmountInput(raw)
              const val = raw === '' ? null : parseFloat(raw)
              if (val === null || val === expense.default_amount) {
                onDebouncedUpdate(expense.id, 'amount_override', null)
              } else {
                onDebouncedUpdate(expense.id, 'amount_override', val)
              }
            }}
            onBlur={(e) => {
              // Clearing the custom amount restores the original default
              if (e.target.value === '') {
                setAmountInput(String(expense.default_amount))
                onDebouncedUpdate(expense.id, 'amount_override', null)
              }
            }}
            className={`w-24 text-right ${inputClass} ${hasOverride ? 'border-primary bg-primary/5' : ''}`}
          />
          {hasOverride && !expense.is_split && (
            <div className="text-[10px] text-text-muted mt-0.5">
              default: {formatCurrency(expense.default_amount)}
            </div>
          )}
          {expense.is_split && (
            <div className="text-[10px] mt-0.5 whitespace-nowrap">
              <span className="text-text-muted">{formatCurrency(budgeted)} budgeted</span>
              {owed - budgeted > 0.005 ? (
                <span className="text-warning font-bold ml-1">{formatCurrency(owed - budgeted)} left</span>
              ) : (
                <span className="text-success font-bold ml-1">fully budgeted</span>
              )}
            </div>
          )}
          {!isLocked && (
            <button
              onClick={() => onToggleSplit(expense.id, !expense.is_split)}
              disabled={isPending}
              className="text-[10px] text-primary font-semibold hover:underline mt-0.5 block disabled:opacity-50"
            >
              {expense.is_split ? '✕ Unsplit' : '+ Split / partial'}
            </button>
          )}
        </td>

        {/* Account (compact — full name on hover) */}
        <td className="px-2 py-3 text-caption text-text-muted">
          <span className="block max-w-[64px] truncate" title={expense.account || ''}>{expense.account || '—'}</span>
        </td>

        {/* Priority (just the P# code — full name on hover) */}
        <td className="px-2 py-3">
          {expense.priority_category && (
            <span title={expense.priority_category} className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getPriorityPill(expense.priority_category, categoryColorMap)}`}>
              {priorityCode(expense.priority_category)}
            </span>
          )}
        </td>

        {/* Due Day */}
        <td className="px-3 py-3 text-caption text-text-muted text-center">{expense.due_day || '—'}</td>

        {/* Paid */}
        <td className="text-center px-3 py-3">
          <input
            type="checkbox"
            checked={expense.is_split ? fullyPaid : expense.paid}
            onChange={(e) => onCheckboxChange(expense.id, 'paid', e.target.checked)}
            disabled={expense.is_split || rowDisabled}
            className="rounded"
          />
        </td>

        {/* Cleared */}
        <td className="text-center px-3 py-3">
          <input
            type="checkbox"
            checked={expense.is_split ? splitCleared : expense.cleared}
            onChange={(e) => onToggleCleared(expense.id, e.target.checked)}
            disabled={expense.is_split || isLocked}
            title="Cleared — settles & removes from the live balance"
            className="rounded"
          />
        </td>

        {/* Delete (one-time / extra expenses only) */}
        {onRemove && (
          <td className="text-center px-3 py-3">
            {!rowDisabled && (
              <button
                onClick={() => onRemove(expense.id)}
                disabled={isPending}
                title="Delete this expense from this budget"
                className="text-caption font-semibold text-text-muted hover:text-warning transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </td>
        )}
      </tr>

      {/* Sub-payment rows */}
      {expense.is_split &&
        payments.map((p) => (
          <SubPaymentRow
            key={p.id}
            payment={p}
            parentAccount={expense.account}
            disabled={rowDisabled}
            isPending={isPending}
            onPaymentField={onPaymentField}
            onPaymentToggle={onPaymentToggle}
            onPaymentCleared={onPaymentCleared}
            onRemovePayment={onRemovePayment}
            inputClass={inputClass}
          />
        ))}
      {expense.is_split && !rowDisabled && (
        <tr className="bg-[#ebf0f0]">
          <td />
          <td className="px-3 py-2 pl-8" colSpan={onRemove ? 8 : 7}>
            <button
              onClick={() => onAddPayment(expense.id)}
              disabled={isPending}
              className="text-caption text-primary font-semibold hover:underline disabled:opacity-50"
            >
              + Add payment
            </button>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Sub-Payment Row ─────────────────────────────────────────────
function SubPaymentRow({
  payment,
  parentAccount,
  disabled,
  isPending,
  onPaymentField,
  onPaymentToggle,
  onPaymentCleared,
  onRemovePayment,
  inputClass,
}: {
  payment: PeriodExpensePayment
  parentAccount: string | null
  disabled: boolean
  isPending: boolean
  onPaymentField: (paymentId: string, field: string, value: string | number | boolean | null) => void
  onPaymentToggle: (paymentId: string, field: string, value: boolean) => void
  onPaymentCleared: (paymentId: string, value: boolean) => void
  onRemovePayment: (paymentId: string) => void
  inputClass: string
}) {
  // A cleared installment is settled — lock its fields (Clear stays toggleable to reopen).
  const locked = disabled || payment.cleared
  return (
    <tr className={payment.cleared ? 'bg-[#ebf0f0] opacity-60' : payment.pay_now ? 'bg-primary-teal/[0.15]' : 'bg-[#ebf0f0]'}>
      {/* Pay (to-pay) — what this installment commits to the budget */}
      <td className="text-center px-3 py-2">
        <input
          type="checkbox"
          checked={payment.pay_now}
          disabled={locked}
          onChange={(e) => onPaymentToggle(payment.id, 'pay_now', e.target.checked)}
          className="rounded"
        />
      </td>
      {/* Label */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 pl-5 text-text-muted">
          <span className="text-[10px]">↳</span>
          <input
            type="text"
            defaultValue={payment.label ?? ''}
            placeholder="Payment"
            disabled={locked}
            onChange={(e) => onPaymentField(payment.id, 'label', e.target.value)}
            className={`w-28 text-caption ${inputClass}`}
          />
          {!locked && (
            <button onClick={() => onRemovePayment(payment.id)} disabled={isPending} title="Remove this payment" className="text-text-muted hover:text-warning text-[10px] disabled:opacity-50">
              ✕
            </button>
          )}
        </div>
      </td>
      {/* Amount */}
      <td className="px-3 py-2">
        <input
          type="number"
          step="0.01"
          defaultValue={payment.amount > 0 ? payment.amount : ''}
          placeholder="0.00"
          disabled={locked}
          onChange={(e) => onPaymentField(payment.id, 'amount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
          className={`w-24 text-right ${inputClass}`}
        />
      </td>
      {/* Account (inherits parent) */}
      <td className="px-3 py-2 text-[10px] text-text-muted whitespace-nowrap">{parentAccount || '—'}</td>
      {/* Priority (none) */}
      <td />
      {/* Due */}
      <td className="px-3 py-2 text-center">
        <input
          type="number"
          defaultValue={payment.due_day ?? ''}
          placeholder="—"
          disabled={locked}
          onChange={(e) => onPaymentField(payment.id, 'due_day', e.target.value === '' ? null : parseInt(e.target.value, 10))}
          className={`w-12 text-center ${inputClass}`}
        />
      </td>
      {/* Paid */}
      <td className="text-center px-3 py-2">
        <input type="checkbox" checked={payment.paid} disabled={locked} onChange={(e) => onPaymentToggle(payment.id, 'paid', e.target.checked)} className="rounded" />
      </td>
      {/* Cleared */}
      <td className="text-center px-3 py-2">
        <input type="checkbox" checked={payment.cleared} disabled={disabled} onChange={(e) => onPaymentCleared(payment.id, e.target.checked)} className="rounded" />
      </td>
    </tr>
  )
}
