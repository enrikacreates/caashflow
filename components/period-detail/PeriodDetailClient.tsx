'use client'

import { useState, useTransition, useCallback, useRef, useEffect, useOptimistic } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronsDownUp, ChevronsUpDown, Pencil, Camera } from 'lucide-react'
import {
  updateExpenseField,
  updateDeductionOverrides,
  linkInvoiceToPeriod,
  unlinkInvoiceFromPeriod,
  addManualIncome,
  removeManualIncome,
  recalculatePeriodIncome,
  toggleExpenseSplit,
  toggleExpenseOverdue,
  setExpenseFunded,
  setExpenseCleared,
  bulkMarkPaid,
  settleAndResetPeriod,
  clearAllPayNow,
  addExpensePayment,
  updateExpensePayment,
  removeExpensePayment,
  addExpenseSpend,
  updateExpenseSpend,
  removeExpenseSpend,
  uploadReceiptImage,
  extractReceiptTotal,
  toggleManualIncomeDone,
  setManualIncomeExcluded,
  toggleLinkedInvoiceDone,
  addAdjustment,
  removeAdjustment,
  addOneTimeExpense,
  removePeriodExpense,
  setAccountTransferDone,
  setAccountCashDone,
  setDeductionPaid,
  setDeductionCash,
} from '@/app/actions/period-expenses'
import { completePeriod, reopenPeriod } from '@/app/actions/periods'
import { smallConfetti, bigConfetti } from '@/lib/confetti'
import { formatCurrency, formatDate, getOwedAmount, getPriorityPill } from '@/lib/utils'
import BudgetSummaryBar from '@/components/dashboard/BudgetSummaryBar'
import { calculateDeductions, calculatePayNowTotal, calculateAccountTransferDetail, getDeductionAccountAllocations, getBudgetedAmount, isFullyPaid, calculatePeriodPaymentSummary, getSpentSoFar } from '@/lib/calculations'
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

type SortKey = 'name' | 'default_amount' | 'priority_category' | 'account' | 'due_day' | 'frequency' | 'pay_now' | 'is_cash' | 'cleared'
type SortDir = 'asc' | 'desc'

/** Compact priority label — "P1: Essentials" → "P1" (keeps the table narrow). */
function priorityCode(name: string): string {
  const m = name.match(/p\s*\d+/i)
  return (m ? m[0] : name.split(':')[0]).replace(/\s+/g, '').toUpperCase().slice(0, 3)
}

// Collapsible period sections, in render order — drives the Expand/Collapse-all toggle
const SECTION_KEYS = ['transfers', 'income', 'deductions', 'savings', 'expenses', 'extra'] as const

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
  linkableInvoices: Invoice[]
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
  accountsCashDone: string[]
}

export default function PeriodDetailClient({
  period,
  expenses,
  linkedInvoices,
  manualIncome,
  linkableInvoices,
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
  accountsCashDone,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Build a lookup map: category name → color_key
  const categoryColorMap = new Map(categories.map(c => [c.name, c.color_key]))
  const [sortKey, setSortKey] = useState<SortKey>('priority_category')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [expenseSearch, setExpenseSearch] = useState('')
  const [showInvoiceSelector, setShowInvoiceSelector] = useState(false)
  const [showManualIncomeForm, setShowManualIncomeForm] = useState(false)
  const [showOneTimeForm, setShowOneTimeForm] = useState(false)
  const [editExpense, setEditExpense] = useState<PeriodExpense | null>(null)
  // Collapsible sections — open by default; a key set true means collapsed.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const isOpen = (k: string) => !collapsed[k]
  const toggleSection = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }))
  const allCollapsed = SECTION_KEYS.every((k) => collapsed[k])
  const setAllSections = (value: boolean) => setCollapsed(Object.fromEntries(SECTION_KEYS.map((k) => [k, value])))
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
    (state: PeriodManualIncome[], u: { id: string } & Partial<PeriodManualIncome>) =>
      state.map((mi) => (mi.id === u.id ? { ...mi, ...u } : mi))
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

  // Which accounts have had their cash withdrawn — flips instantly
  const [cashDone, applyCashDoneOpt] = useOptimistic(
    new Set(accountsCashDone),
    (state: Set<string>, u: { account: string; done: boolean }) => {
      const next = new Set(state)
      if (u.done) next.add(u.account)
      else next.delete(u.account)
      return next
    }
  )
  const handleToggleCashDone = (account: string, done: boolean) =>
    startTransition(async () => {
      applyCashDoneOpt({ account, done })
      await setAccountCashDone(period.id, account, done)
    })

  // Per-deduction "set aside / paid" checkmarks — flip instantly, server reconciles
  const [deductionPaid, applyDeductionPaidOpt] = useOptimistic(
    new Set(Object.entries(period.deduction_paid ?? {}).filter(([, v]) => v).map(([k]) => k)),
    (state: Set<string>, u: { key: string; done: boolean }) => {
      const next = new Set(state)
      if (u.done) next.add(u.key)
      else next.delete(u.key)
      return next
    }
  )
  const handleToggleDeductionPaid = (key: string, done: boolean) =>
    startTransition(async () => {
      applyDeductionPaidOpt({ key, done })
      await setDeductionPaid(period.id, key, done)
    })

  // Which deductions are taken as cash (e.g. Giving) — flips instantly
  const [deductionCash, applyDeductionCashOpt] = useOptimistic(
    new Set(Object.entries(period.deduction_cash ?? {}).filter(([, v]) => v).map(([k]) => k)),
    (state: Set<string>, u: { key: string; on: boolean }) => {
      const next = new Set(state)
      if (u.on) next.add(u.key)
      else next.delete(u.key)
      return next
    }
  )
  const handleToggleDeductionCash = (key: string, on: boolean) =>
    startTransition(async () => {
      applyDeductionCashOpt({ key, on })
      await setDeductionCash(period.id, key, on)
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
  // Cash to withdraw per account — sum of amounts flagged 💵
  const cashByAccount = optExpenses.reduce<Record<string, number>>((acc, e) => {
    if (!e.is_cash) return acc
    const amt = getOwedAmount(e)
    if (amt <= 0) return acc
    const account = e.account || 'Unknown'
    acc[account] = (acc[account] || 0) + amt
    return acc
  }, {})
  // Giving taken as cash → fold its amount into its account's cash total
  if (deductionCash.has('fun_money') && settings.fun_money_account && deductions.funMoney > 0) {
    cashByAccount[settings.fun_money_account] = (cashByAccount[settings.fun_money_account] || 0) + deductions.funMoney
  }
  const totalCash = Object.values(cashByAccount).reduce((s, v) => s + v, 0)
  // Adjustments reduce/raise what's left to budget — deductions stay on the full check
  const adjustment = adjustments.reduce((sum, a) => sum + (a.amount || 0), 0)
  const availableToBudget = deductions.incomeAfterDeductions + adjustment
  const amountLeft = availableToBudget - payNowTotal
  // Still projected = this month's invoices not yet received — income still expected to land
  const periodMonth = period.period_month?.slice(0, 7) ?? ''
  const stillProjectedIncome = periodMonth
    ? linkableInvoices
        .filter((inv) => inv.status !== 'received' && (inv.month === periodMonth || inv.projected_date?.startsWith(periodMonth) || inv.actual_received_date?.startsWith(periodMonth)))
        .reduce((sum, inv) => sum + inv.amount, 0)
    : 0
  const expenseOwed = (e: PeriodExpense) =>
    e.is_split ? (e.payments ?? []).reduce((s, p) => s + p.amount, 0) : getOwedAmount(e)
  const totalExpenses = optExpenses.reduce((sum, e) => sum + expenseOwed(e), 0)
  // Already settled (cleared/complete) — funded by income that has come and gone.
  const clearedExpenseTotal = optExpenses.reduce((sum, e) => (e.is_complete ? sum + expenseOwed(e) : sum), 0)
  // Expenses with no income behind them yet — what new income should go toward.
  // Excludes both what's committed this period (pay-now) AND what's already cleared.
  const stillToFund = Math.max(0, totalExpenses - payNowTotal - clearedExpenseTotal)
  const paymentSummary = calculatePeriodPaymentSummary(optExpenses)
  // Total deducted off the gross (for the collapsed Deductions hint)
  const totalDeductions = period.income_amount - deductions.incomeAfterDeductions
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
    if (sortKey === 'pay_now') {
      // Group by whether the item is set to pay (handles split via budgeted amount)
      const pa = getBudgetedAmount(a) > 0 ? 1 : 0
      const pb = getBudgetedAmount(b) > 0 ? 1 : 0
      return (pa - pb) * mul
    }
    if (sortKey === 'is_cash') return (Number(a.is_cash) - Number(b.is_cash)) * mul
    if (sortKey === 'cleared') {
      const ca = a.is_split ? ((a.payments ?? []).length > 0 && (a.payments ?? []).every((p) => p.cleared)) : a.cleared
      const cb = b.is_split ? ((b.payments ?? []).length > 0 && (b.payments ?? []).every((p) => p.cleared)) : b.cleared
      return (Number(ca) - Number(cb)) * mul
    }
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
  const owedOf = (e: PeriodExpense) => (e.is_split ? (e.payments ?? []).reduce((s, p) => s + p.amount, 0) : getOwedAmount(e))
  const oneTimeTotal = oneTimeExpenses.reduce((s, e) => s + owedOf(e), 0)

  // Free-text search across name / account / priority / amount / due / notes / tags.
  // Filters only the rendered rows — period totals still reflect every expense.
  const q = expenseSearch.trim().toLowerCase()
  const matchesSearch = (e: PeriodExpense) => {
    if (!q) return true
    const haystack = [
      e.name,
      e.account,
      e.priority_category,
      e.notes,
      (e.tags ?? []).join(' '),
      String(owedOf(e)),
      e.default_amount != null ? String(e.default_amount) : '',
      e.due_day != null ? String(e.due_day) : '',
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(q)
  }
  // Expenses rollup funnel: Paid = funded/set aside, Cleared = actually left the account.
  const isClosed = (e: PeriodExpense) =>
    e.is_split ? (e.payments ?? []).length > 0 && (e.payments ?? []).every((p) => p.cleared) : e.is_complete
  const fundedTotal = optExpenses.reduce((s, e) => s + (isFullyPaid(e) ? owedOf(e) : 0), 0)
  const clearedTotal = optExpenses.reduce((s, e) => s + (isClosed(e) ? getSpentSoFar(e) : 0), 0)

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

  // Paid = "funded" (money set aside → enters the spend-tracking phase). It no longer books the
  // full amount; spend is booked as it's logged, and Clear is what counts as paid in the roundup.
  const handleCheckboxChange = (expenseId: string, field: string, value: boolean) => {
    startTransition(async () => {
      applyExpenseOpt({ kind: 'field', id: expenseId, field, value })
      if (field === 'paid') {
        // Funding/unfunding reconciles booked spend back to the logged total.
        const exp = optExpenses.find((e) => e.id === expenseId)
        const ledger = (exp?.adjustments ?? []).reduce((s, a) => s + (a.amount || 0), 0)
        applyExpenseOpt({ kind: 'field', id: expenseId, field: 'paid_amount', value: ledger })
        const res = await setExpenseFunded(expenseId, period.id, value)
        // Debt/savings book in full on funding → celebrate the milestone.
        if (value && res) {
          if (res.savingsAchieved) await bigConfetti()
          else if (res.exceedsMinimum || res.savingsExceedsMonthly) await smallConfetti()
        }
      } else {
        await updateExpenseField(expenseId, field, value)
      }
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
      applyManualOpt({ id, is_done: value })
      await toggleManualIncomeDone(id, period.id, value)
    })

  const handleToggleManualExcluded = (id: string, value: boolean) =>
    startTransition(async () => {
      applyManualOpt({ id, exclude_from_reports: value })
      await setManualIncomeExcluded(id, period.id, value)
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

  // "Clear" is the terminal settle: the money has cleared the account → counts as paid in the
  // roundup, tops the line up to its funded amount, drops it from the live balance + seals it.
  const handleToggleCleared = (id: string, value: boolean) => {
    const exp = optExpenses.find((e) => e.id === id)
    const funded = exp ? (exp.amount_override ?? exp.default_amount) : 0
    const ledger = (exp?.adjustments ?? []).reduce((s, a) => s + (a.amount || 0), 0)
    startTransition(async () => {
      applyExpenseOpt({ kind: 'field', id, field: 'cleared', value })
      applyExpenseOpt({ kind: 'field', id, field: 'is_complete', value })
      applyExpenseOpt({ kind: 'field', id, field: 'paid_amount', value: value ? Math.max(funded, ledger) : ledger })
      if (value) {
        applyExpenseOpt({ kind: 'field', id, field: 'paid', value: true })
        applyExpenseOpt({ kind: 'field', id, field: 'pay_now', value: false })
      }
      const res = await setExpenseCleared(id, period.id, value)
      // Clearing a debt/savings line that wasn't funded first books it now → celebrate.
      if (value && res) {
        if (res.savingsAchieved) await bigConfetti()
        else if (res.exceedsMinimum || res.savingsExceedsMonthly) await smallConfetti()
      }
    })
  }

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

  // ─── Spend ledger (per-line draw-down) ───────────────────────
  const handleAddSpend = (id: string, amount: number, note: string | null, imageUrl: string | null = null) =>
    startTransition(() => addExpenseSpend(id, period.id, amount, note, imageUrl))

  const handleRemoveSpend = (adjustmentId: string) =>
    startTransition(() => removeExpenseSpend(adjustmentId, period.id))

  // Attach (or clear) a receipt photo on an existing spend entry.
  const handleAttachSpendImage = (adjustmentId: string, imageUrl: string | null) =>
    startTransition(() => updateExpenseSpend(adjustmentId, period.id, { image_url: imageUrl }))

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
  const handleClearAllPayNow = () => {
    if (!confirm('Clear all pay-now items?\n\nSettles every line checked to Pay (like clicking Clear on each). Rows not set to Pay are untouched. Nothing is deleted — reopen any row individually.')) return
    startTransition(async () => { await clearAllPayNow(period.id) })
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

      {/* Expand / collapse all sections */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAllSections(!allCollapsed)}
          title={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
          className="inline-flex items-center gap-1.5 bg-bg-white shadow-card rounded-full px-3.5 py-1.5 text-caption font-semibold text-text-muted hover:text-text-heading transition-colors"
        >
          {allCollapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
          {allCollapsed ? 'Expand all' : 'Collapse all'}
        </button>
      </div>

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
      <div ref={summaryCardsRef}>
        <BudgetSummaryBar
          income={period.income_amount}
          toBudget={deductions.incomeAfterDeductions}
          payNow={payNowTotal}
          paid={paymentSummary.paid}
          amountLeft={amountLeft}
          totalExpenses={totalExpenses}
          stillToFund={stillToFund}
          stillProjected={stillProjectedIncome}
        />
      </div>

      {/* ─── Sticky Summary Bar (visible when scrolled past cards) ── */}
      {showStickyBar && (
        <div className="sticky top-[72px] md:top-[84px] z-40 -mx-6 px-6 -mt-4">
          <div className="bg-[#ebf0f0] rounded-b-lg shadow-card px-4 py-2 flex items-center justify-between gap-4">
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
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
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
            {!isOpen('transfers') && (
              <span className="text-caption text-text-muted">
                {Object.entries(accountTransfers).map(([account, d]) => `${account} ${formatCurrency(d.remaining)}`).join('  ·  ')}
              </span>
            )}
          </div>
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
                    {cashByAccount[account] > 0 && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <button
                          type="button"
                          onClick={() => handleToggleCashDone(account, !cashDone.has(account))}
                          disabled={isLocked}
                          title={cashDone.has(account) ? 'Cash withdrawn — tap to undo' : 'Mark cash as withdrawn'}
                          className={`shrink-0 w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] leading-none transition-colors disabled:opacity-50 ${
                            cashDone.has(account) ? 'bg-success border-success text-text-inverse' : 'border-border text-transparent hover:border-primary'
                          }`}
                        >
                          ✓
                        </button>
                        <span className={`text-[10px] whitespace-nowrap ${cashDone.has(account) ? 'text-success line-through' : 'text-text-heading/80'}`}>
                          💵 {formatCurrency(cashByAccount[account])} cash
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {isOpen('transfers') && totalCash > 0 && (
            <div className="mt-4 flex items-center text-caption">
              <span className="font-bold uppercase text-text-muted">💵 Total cash to pull</span>
              <span className="font-bold text-text-heading ml-auto">{formatCurrency(totalCash)}</span>
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
          {!isOpen('income') && (
            <span className="text-caption text-text-muted">
              {formatCurrency(period.income_amount)} received{stillProjectedIncome > 0 && ` · ${formatCurrency(stillProjectedIncome)} still projected`}
            </span>
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
                    {mi.exclude_from_reports && (
                      <span className="text-[10px] bg-surface-beige text-text-muted px-1.5 py-0.5 rounded-full font-bold uppercase">Not income</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-caption font-bold text-text-heading">{formatCurrency(mi.amount)}</span>
                    <span
                      className="flex items-center gap-1 text-caption text-text-muted cursor-help"
                      title="Exclude from income reports: keeps this out of the 6-month income chart and trends (e.g. gifts, reimbursements). It still counts in this budget."
                    >
                      <input
                        type="checkbox"
                        checked={mi.exclude_from_reports}
                        disabled={isLocked || isPending}
                        onChange={(e) => handleToggleManualExcluded(mi.id, e.target.checked)}
                        className="rounded"
                      />
                      Not income
                    </span>
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
            <div className="text-caption font-bold text-text-muted uppercase mb-2">Select Income to Link</div>
            {linkableInvoices.filter((inv) => !linkedInvoiceIds.has(inv.id)).length === 0 ? (
              <p className="text-caption text-text-muted">No unlinked income available.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {linkableInvoices
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
                        {inv.status !== 'received' && (
                          <span className="text-[10px] uppercase font-bold text-text-muted bg-bg-white px-1.5 py-0.5 rounded-full">{inv.status}</span>
                        )}
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
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-4">
          <h2 className="text-h3 font-bold text-text-heading">
            <button type="button" onClick={() => toggleSection('deductions')} className="inline-flex items-center gap-2 hover:text-primary transition-colors">
              <span className="text-text-muted text-base leading-none">{isOpen('deductions') ? '▾' : '▸'}</span>
              Deductions
            </button>
          </h2>
          {!isOpen('deductions') && (
            <span className="text-caption text-text-muted">
              {formatCurrency(totalDeductions)} deducted · {formatCurrency(deductions.incomeAfterDeductions)} to budget
            </span>
          )}
        </div>
        {isOpen('deductions') && (<>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-4">
          {([
            { pctKey: 'tithe_percentage', amtKey: 'tithe_amount', label: 'Tithe', detail: deductions.details.titheD, accountKey: 'tithe_account' },
            { pctKey: 'savings_percentage', amtKey: 'savings_amount', label: 'Savings', detail: deductions.details.savingsD, accountKey: 'savings_account' },
            { pctKey: 'tax_percentage', amtKey: 'tax_amount', label: 'Tax', detail: deductions.details.taxD, accountKey: 'tax_account' },
            { pctKey: 'profit_percentage', amtKey: 'profit_amount', label: 'Profit', detail: deductions.details.profitD, accountKey: 'profit_account' },
            { pctKey: 'fun_money_percentage', amtKey: 'fun_money_amount', label: 'Giving', detail: deductions.details.funMoneyD, accountKey: 'fun_money_account' },
          ] as const).map(({ pctKey, amtKey, label, detail, accountKey }) => {
            const hasOverride =
              overridesLocal?.[pctKey as keyof DeductionOverrides] !== undefined ||
              overridesLocal?.[amtKey as keyof DeductionOverrides] !== undefined
            const dkey = pctKey.replace('_percentage', '')
            const paid = deductionPaid.has(dkey)
            return (
              <div key={pctKey} className="text-center">
                <div className="text-caption font-bold text-text-muted uppercase mb-1">{label}</div>
                {/* % | $ toggle + paid checkmark */}
                <div className="flex justify-center items-center gap-2 mb-1">
                  {dkey === 'fun_money' && (
                    <button
                      type="button"
                      onClick={() => handleToggleDeductionCash(dkey, !deductionCash.has(dkey))}
                      disabled={isLocked}
                      title={deductionCash.has(dkey) ? 'Taking as cash — tap to leave in account' : 'Take this as cash'}
                      className={`text-base leading-none transition-opacity disabled:opacity-40 ${deductionCash.has(dkey) ? 'opacity-100' : 'opacity-25 hover:opacity-70'}`}
                    >
                      💵
                    </button>
                  )}
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
                  <button
                    type="button"
                    onClick={() => handleToggleDeductionPaid(dkey, !paid)}
                    disabled={isLocked}
                    title={paid ? 'Marked set aside — tap to undo' : 'Mark this deduction as set aside / paid'}
                    className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center text-[9px] leading-none transition-colors disabled:opacity-50 ${
                      paid ? 'bg-success border-success text-text-inverse' : 'border-border text-transparent hover:border-primary'
                    }`}
                  >
                    ✓
                  </button>
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
                  <div className={`text-caption font-bold ${paid ? 'text-success' : 'text-text-heading'}`}>{formatCurrency(detail.amount)}</div>
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
              Nothing set aside yet. As you mark income <span className="font-semibold">Done</span>, its tithe / savings / tax / profit / giving get logged here and totaled for the period.
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
                    <th className="text-right font-bold uppercase py-1 px-2">Giving</th>
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
          open={isOpen('savings')}
          onToggleOpen={() => toggleSection('savings')}
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
          {/* Payment rollup — funnel: budgeted → funded(Paid) → spent → cleared, plus total */}
          <div className="flex items-center gap-3 text-caption flex-wrap">
            <span className="text-text-muted">Budgeted <span className="font-bold text-text-heading">{formatCurrency(paymentSummary.budgeted)}</span></span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">Paid <span className="font-bold text-text-heading">{formatCurrency(fundedTotal)}</span></span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">Cleared <span className="font-bold text-primary-teal">{formatCurrency(clearedTotal)}</span></span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">Total <span className="font-bold text-text-heading">{formatCurrency(totalExpenses)}</span></span>
          </div>
        </div>

        {isOpen('expenses') && (
        <>
        {/* Search — filters the rows below; totals above still reflect every expense */}
        <div className="mb-3 flex items-center gap-2">
          <input
            type="text"
            value={expenseSearch}
            onChange={(e) => setExpenseSearch(e.target.value)}
            placeholder="Search expenses — name, amount, account, priority…"
            className={`${inputClass} flex-1 sm:max-w-sm`}
          />
          {expenseSearch && (
            <button type="button" onClick={() => setExpenseSearch('')} title="Clear search" className="text-caption text-text-muted hover:text-warning font-semibold shrink-0">✕</button>
          )}
          <button
            type="button"
            onClick={handleClearAllPayNow}
            disabled={isLocked}
            title="Clear all pay-now items — settles every row checked to Pay (rows not set to Pay are untouched)"
            className="ml-auto shrink-0 text-[10px] font-bold uppercase bg-primary-teal/10 text-primary rounded-full px-3 py-1.5 hover:bg-primary-teal/20 transition-colors disabled:opacity-50"
          >
            All
          </button>
        </div>
        <div className="rounded-lg overflow-auto max-h-[70vh]">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-bg-white [&>th]:sticky [&>th]:top-0 [&>th]:z-20 [&>th]:bg-bg-white [&>th]:border-b [&>th]:border-[#e9e9e9]">
                  <th className="text-center px-1.5 py-3 text-caption font-bold uppercase text-text-muted cursor-pointer hover:text-text-heading select-none whitespace-nowrap" onClick={() => handleSort('pay_now')} title="Sort by pay">Pay<SortIcon col="pay_now" /></th>
                  <th className={thClass} onClick={() => handleSort('name')}>
                    Name<SortIcon col="name" />
                  </th>
                  <th className={thClass} onClick={() => handleSort('default_amount')}>
                    Amount<SortIcon col="default_amount" />
                  </th>
                  <th className={`${thClass} w-[1%]`} onClick={() => handleSort('account')}>
                    Acct<SortIcon col="account" />
                  </th>
                  <th className="text-center px-3 py-3 text-caption font-bold uppercase text-text-muted w-[1%] whitespace-nowrap cursor-pointer hover:text-text-heading select-none" onClick={() => handleSort('is_cash')} title="Sort by cash"><span className="inline-block align-middle text-[12px] leading-none">💵</span><SortIcon col="is_cash" /></th>
                  <th className={`${thClass} w-[1%]`} onClick={() => handleSort('priority_category')}>
                    Pri<SortIcon col="priority_category" />
                  </th>
                  <th className={`${thClass} w-[1%]`} onClick={() => handleSort('due_day')}>
                    Due<SortIcon col="due_day" />
                  </th>
                  <th className="text-center px-1.5 py-3">
                    <button type="button" onClick={handleBulkPaid} disabled={isLocked} title="Mark all to-pay items paid" className="text-caption font-bold uppercase text-text-muted hover:text-primary transition-colors disabled:opacity-50">Paid</button>
                  </th>
                  <th className="text-center px-1.5 py-3 text-caption font-bold uppercase text-text-muted cursor-pointer hover:text-text-heading select-none whitespace-nowrap" onClick={() => handleSort('cleared')} title="Sort by cleared">Clear<SortIcon col="cleared" /></th>
                </tr>
              </thead>
              <tbody>
                {baselineExpenses.filter(matchesSearch).map((expense) => (
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
                    onAddSpend={handleAddSpend}
                    onRemoveSpend={handleRemoveSpend}
                    onAttachSpendImage={handleAttachSpendImage}
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
                  <td colSpan={6} />
                </tr>
              </tfoot>
            </table>
        </div>
        </>
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
          {!isOpen('extra') && oneTimeExpenses.length > 0 && (
            <span className="text-caption text-text-muted">{oneTimeExpenses.length} {oneTimeExpenses.length === 1 ? 'item' : 'items'} · {formatCurrency(oneTimeTotal)}</span>
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
                    <th className="text-center px-3 py-3 text-caption font-bold uppercase text-text-muted w-[1%]" title="Withdraw as cash"><span className="inline-block align-middle text-[12px] leading-none">💵</span></th>
                    <th className="text-left px-2 py-3 text-caption font-bold uppercase text-text-muted w-[1%]">Pri</th>
                    <th className="text-left px-2 py-3 text-caption font-bold uppercase text-text-muted w-[1%]">Due</th>
                    <th className="text-center px-3 py-3 text-caption font-bold uppercase text-text-muted">Paid</th>
                    <th className="text-center px-3 py-3 text-caption font-bold uppercase text-text-muted">Clear</th>
                    <th className="text-center px-3 py-3 text-caption font-bold uppercase text-text-muted">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {oneTimeExpenses.filter(matchesSearch).map((expense) => (
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
                      onAddSpend={handleAddSpend}
                      onRemoveSpend={handleRemoveSpend}
                      onAttachSpendImage={handleAttachSpendImage}
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
                    <td colSpan={7} />
                  </tr>
                </tfoot>
              </table>
          </div>
        )}
        </>)}
      </div>

      {/* ─── Requests (wish list → pull into this budget) ──── */}
      <PeriodRequestsPanel requests={requests} periodId={period.id} isLocked={isLocked} categories={categories} />

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
  onAddSpend,
  onRemoveSpend,
  onAttachSpendImage,
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
  onAddSpend: (id: string, amount: number, note: string | null, imageUrl?: string | null) => void
  onRemoveSpend: (adjustmentId: string) => void
  onAttachSpendImage: (adjustmentId: string, imageUrl: string | null) => void
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

  // When split, the parent's Pay/Paid/Clear are derived (read-only) from its sub-payments
  const splitPayNow = expense.is_split && payments.length > 0 && payments.some((p) => p.pay_now)
  const splitCleared = expense.is_split && payments.length > 0 && payments.every((p) => p.cleared)

  const fullyPaid = isFullyPaid(expense)
  // "Settled" = closed/locked (Clear or fully drawn down). Paying-mode alone no longer dims the row.
  const settled = expense.is_complete || splitCleared

  // Spend ledger (per-line draw-down). Once the line is in paid mode the Amount cell turns into a
  // read-only "spent / left" readout and Log replaces Split.
  const adjustments = expense.adjustments ?? []
  const hasLedger = adjustments.length > 0
  const spent = getSpentSoFar(expense) // booked spend (cached in paid_amount)
  const remaining = owed - spent
  // Draw-down (funded readout + Log) is only for tracked, non-linked categories (groceries, gas…).
  // Fixed bills + debt/savings aren't pay-as-you-go: funding books them in full, no logging.
  const isLinked = !!(expense.debt_id || expense.savings_goal_id)
  const isDrawDown = expense.track_spending && !isLinked
  const inPaidMode = !expense.is_split && expense.paid && isDrawDown // spending/logging phase
  const [spendOpen, setSpendOpen] = useState(hasLedger && !expense.is_complete)
  const [spendMode, setSpendMode] = useState<'spent' | 'left'>('spent')
  const [spendAmt, setSpendAmt] = useState('')
  const [spendNote, setSpendNote] = useState('')
  const r2 = (n: number) => Math.round(n * 100) / 100
  const enteredSpend = spendAmt === '' ? NaN : parseFloat(spendAmt)
  const resolvedSpend = isNaN(enteredSpend) ? NaN : spendMode === 'left' ? r2(remaining - enteredSpend) : enteredSpend
  // Receipt photo capture. A null target uploads onto the new spend being entered;
  // a set target attaches the photo to that existing ledger entry.
  const [spendImage, setSpendImage] = useState<string | null>(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [attachTarget, setAttachTarget] = useState<string | null>(null)
  const receiptInputRef = useRef<HTMLInputElement>(null)
  const pickReceipt = (targetId: string | null) => {
    setAttachTarget(targetId)
    receiptInputRef.current?.click()
  }
  const handleReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingReceipt(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const url = await uploadReceiptImage(fd)
      if (attachTarget) {
        onAttachSpendImage(attachTarget, url)
      } else {
        setSpendImage(url)
        // Blank amount → read the total off the receipt as an editable default.
        if (spendAmt.trim() === '') {
          const total = await extractReceiptTotal(url)
          if (total != null) {
            setSpendMode('spent')
            setSpendAmt(String(total))
          }
        }
      }
    } catch (err) {
      console.error('Receipt upload failed', err)
    } finally {
      setUploadingReceipt(false)
      setAttachTarget(null)
      if (receiptInputRef.current) receiptInputRef.current.value = ''
    }
  }
  const handleLogSpend = () => {
    if (isNaN(resolvedSpend) || resolvedSpend === 0) return
    onAddSpend(expense.id, resolvedSpend, spendNote.trim() || null, spendImage)
    setSpendAmt('')
    setSpendNote('')
    setSpendImage(null)
  }

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
        <td className="text-center px-1.5 py-3">
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

        {/* Amount — editable while funding; locks to a spent/left readout once funded (paid mode) */}
        <td className="px-3 py-3">
          {inPaidMode ? (
            <>
              {/* Read-only draw-down readout: spent / left */}
              <div className="text-right tabular-nums whitespace-nowrap leading-tight text-caption">
                <span className="font-bold text-text-heading">{formatCurrency(spent)}</span>
                <span className="text-text-muted"> / </span>
                {remaining < -0.005 ? (
                  <span className="font-bold text-warning">{formatCurrency(-remaining)}</span>
                ) : (
                  <span className={`font-bold ${remaining <= 0.005 ? 'text-success' : 'text-text-heading'}`}>{formatCurrency(Math.max(0, remaining))}</span>
                )}
                <span className="block text-[10px] text-text-muted font-normal">
                  {remaining > 0.005 ? 'spent / left' : remaining < -0.005 ? 'spent / over' : 'fully spent'}
                </span>
              </div>
              {!isLocked && !isLinked && (
                <button
                  onClick={() => setSpendOpen((o) => !o)}
                  disabled={isPending}
                  title={spendOpen ? 'Close spend ledger' : hasLedger ? `Edit spends (${adjustments.length})` : 'Log a spend'}
                  aria-label="Log or adjust spend"
                  className={`mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${spendOpen ? 'text-primary-teal' : 'text-primary hover:text-primary-teal'}`}
                >
                  <Pencil size={12} aria-hidden="true" />
                  <span>Log{hasLedger ? ` (${adjustments.length})` : ''}</span>
                </button>
              )}
            </>
          ) : (
            <>
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
              {/* Tracked draw-down progress — shown once spends are logged, even before Paid */}
              {isDrawDown && !expense.is_split && hasLedger && (
                <div className="text-[10px] mt-0.5 whitespace-nowrap">
                  <span className="text-text-muted">{formatCurrency(spent)} spent</span>
                  {remaining > 0.005 ? (
                    <span className="text-success font-bold ml-1">{formatCurrency(remaining)} left</span>
                  ) : remaining < -0.005 ? (
                    <span className="text-warning font-bold ml-1">{formatCurrency(-remaining)} over</span>
                  ) : (
                    <span className="text-success font-bold ml-1">fully spent</span>
                  )}
                </div>
              )}
              {/* Tracked lines log spends (draw-down); everything else gets Split / partial */}
              {!isLocked && isDrawDown && !expense.is_split ? (
                <button
                  onClick={() => setSpendOpen((o) => !o)}
                  disabled={isPending}
                  title={spendOpen ? 'Close spend ledger' : hasLedger ? `Edit spends (${adjustments.length})` : 'Log a spend'}
                  aria-label="Log or adjust spend"
                  className={`mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${spendOpen ? 'text-primary-teal' : 'text-primary hover:text-primary-teal'}`}
                >
                  <Pencil size={12} aria-hidden="true" />
                  <span>Log{hasLedger ? ` (${adjustments.length})` : ''}</span>
                </button>
              ) : !isLocked ? (
                <button
                  onClick={() => onToggleSplit(expense.id, !expense.is_split)}
                  disabled={isPending}
                  className="text-[10px] text-primary font-semibold hover:underline mt-0.5 block disabled:opacity-50"
                >
                  {expense.is_split ? '✕ Unsplit' : '+ Split / partial'}
                </button>
              ) : null}
            </>
          )}
        </td>

        {/* Account (compact — full name on hover) */}
        <td className="px-2 py-3 text-caption text-text-muted">
          <span className="block max-w-[64px] truncate" title={expense.account || ''}>{expense.account || '—'}</span>
        </td>

        {/* Cash — withdraw this amount as cash from the account */}
        <td className="text-center px-3 py-3">
          <button
            type="button"
            onClick={() => onCheckboxChange(expense.id, 'is_cash', !expense.is_cash)}
            disabled={rowDisabled}
            title={expense.is_cash ? 'Withdrawing as cash — tap to undo' : 'Mark to withdraw as cash'}
            className={`text-base leading-none transition-opacity disabled:opacity-40 ${expense.is_cash ? 'opacity-100' : 'opacity-25 hover:opacity-70'}`}
          >
            💵
          </button>
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
        <td className="text-center px-1.5 py-3">
          <input
            type="checkbox"
            checked={expense.is_split ? fullyPaid : expense.paid}
            onChange={(e) => onCheckboxChange(expense.id, 'paid', e.target.checked)}
            disabled={expense.is_split || rowDisabled}
            className="rounded"
          />
        </td>

        {/* Cleared */}
        <td className="text-center px-1.5 py-3">
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
          <td className="text-center px-1.5 py-3">
            {!rowDisabled && (
              <button
                onClick={() => onRemove(expense.id)}
                disabled={isPending}
                title="Remove this expense from this budget"
                className="text-caption font-semibold text-text-muted hover:text-warning transition-colors disabled:opacity-50"
              >
                Remove
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
          <td className="px-3 py-2 pl-8" colSpan={onRemove ? 9 : 8}>
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

      {/* Spend ledger — actual spends drawn down against the funded amount */}
      {!expense.is_split && isDrawDown && spendOpen && (
        <tr className="bg-[#ebf0f0]">
          <td />
          <td className="px-3 py-3 pl-8" colSpan={onRemove ? 9 : 8}>
            {/* Summary line */}
            <div className="text-[11px] text-text-muted mb-2">
              Funded <span className="font-bold text-text-heading">{formatCurrency(owed)}</span>
              <span className="mx-1">·</span>
              Spent <span className="font-bold text-text-heading">{formatCurrency(spent)}</span>
              <span className="mx-1">·</span>
              {remaining > 0.005 ? (
                <span className="text-success font-bold">{formatCurrency(remaining)} left</span>
              ) : remaining < -0.005 ? (
                <span className="text-warning font-bold">{formatCurrency(-remaining)} over</span>
              ) : (
                <span className="text-success font-bold">fully spent</span>
              )}
            </div>

            {/* Logged entries */}
            {hasLedger && (
              <ul className="space-y-1 mb-2 max-w-md">
                {adjustments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-caption">
                    <span className="text-text-muted text-[10px] w-14 shrink-0">{formatDate(a.created_at)}</span>
                    <span className="flex-1 text-text-heading truncate">{a.note || '—'}</span>
                    <span className="font-bold text-text-heading">{formatCurrency(a.amount)}</span>
                    {a.image_url ? (
                      <a href={a.image_url} target="_blank" rel="noopener noreferrer" title="View receipt" className="shrink-0">
                        <img src={a.image_url} alt="Receipt" className="h-6 w-6 object-cover rounded border border-border" />
                      </a>
                    ) : !isLocked ? (
                      <button
                        onClick={() => pickReceipt(a.id)}
                        disabled={uploadingReceipt}
                        title="Attach a receipt photo"
                        className="text-text-muted hover:text-primary disabled:opacity-50"
                      >
                        <Camera size={13} aria-hidden="true" />
                      </button>
                    ) : null}
                    {!isLocked && (
                      <button
                        onClick={() => onRemoveSpend(a.id)}
                        disabled={isPending}
                        title="Remove this spend"
                        className="text-text-muted hover:text-warning text-[10px] disabled:opacity-50"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Add a spend — enter the amount Spent, or the amount you want Left (back-solved) */}
            {!isLocked && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-full border border-border overflow-hidden text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setSpendMode('spent')}
                    className={`px-2.5 py-1 transition-colors ${spendMode === 'spent' ? 'bg-text-heading text-white' : 'bg-bg-white text-text-muted hover:text-text-heading'}`}
                  >
                    Spent
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpendMode('left')}
                    className={`px-2.5 py-1 transition-colors ${spendMode === 'left' ? 'bg-text-heading text-white' : 'bg-bg-white text-text-muted hover:text-text-heading'}`}
                  >
                    Left
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={spendAmt}
                  onChange={(e) => setSpendAmt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLogSpend() }}
                  placeholder={spendMode === 'spent' ? 'Spent' : 'Left'}
                  className={`w-24 text-right ${inputClass}`}
                />
                <input
                  type="text"
                  value={spendNote}
                  onChange={(e) => setSpendNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLogSpend() }}
                  placeholder="Note (e.g. Trader Joe's)"
                  className={`w-44 ${inputClass}`}
                />
                {/* Receipt camera — capture a photo to attach to this spend */}
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleReceiptFile}
                />
                {spendImage ? (
                  <span className="inline-flex items-center gap-1">
                    <img src={spendImage} alt="Receipt" className="h-7 w-7 object-cover rounded border border-border" />
                    <button type="button" onClick={() => setSpendImage(null)} title="Remove photo" className="text-text-muted hover:text-warning text-[10px]">✕</button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => pickReceipt(null)}
                    disabled={uploadingReceipt}
                    title="Snap a receipt photo"
                    className="inline-flex items-center text-text-muted hover:text-primary disabled:opacity-50 p-1"
                  >
                    <Camera size={15} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLogSpend}
                  disabled={isPending || uploadingReceipt || isNaN(resolvedSpend) || resolvedSpend === 0}
                  className="bg-primary-teal text-text-inverse rounded-full px-3 py-1 text-[10px] font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  Log
                </button>
                {uploadingReceipt && <span className="text-[10px] text-text-muted">reading receipt…</span>}
                {spendMode === 'left' && !isNaN(resolvedSpend) && (
                  <span className="text-[10px] text-text-muted">→ logs {formatCurrency(resolvedSpend)} spent</span>
                )}
              </div>
            )}
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
      {/* Cash (n/a for sub-payments) */}
      <td />
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
