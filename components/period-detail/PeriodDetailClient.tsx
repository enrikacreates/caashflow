'use client'

import { useState, useTransition, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  updateExpenseField,
  markExpensePaid,
  updateDeductionOverrides,
  linkInvoiceToPeriod,
  unlinkInvoiceFromPeriod,
  addManualIncome,
  removeManualIncome,
  recalculatePeriodIncome,
} from '@/app/actions/period-expenses'
import { smallConfetti, bigConfetti } from '@/lib/confetti'
import { formatCurrency, getEffectiveAmount, getOwedAmount, getPriorityColor } from '@/lib/utils'
import { calculateDeductions, calculatePayNowTotal, calculateAccountBreakdown } from '@/lib/calculations'
import type { DeductionMode } from '@/lib/calculations'
import SavingsAllocationSection from '@/components/period-detail/SavingsAllocationSection'
import type {
  BudgetPeriod,
  PeriodExpense,
  Invoice,
  PeriodManualIncome,
  Settings,
  DeductionOverrides,
  PriorityCategoryRecord,
  SavingsGoal,
  PeriodSavingsAllocation,
} from '@/lib/types'

type SortKey = 'name' | 'default_amount' | 'priority_category' | 'account' | 'due_day' | 'frequency'
type SortDir = 'asc' | 'desc'

interface LinkedInvoiceRow {
  id: string
  period_id: string
  invoice_id: string
  invoices: Invoice
}

interface Props {
  period: BudgetPeriod
  expenses: PeriodExpense[]
  linkedInvoices: LinkedInvoiceRow[]
  manualIncome: PeriodManualIncome[]
  allReceivedInvoices: Invoice[]
  settings: Settings
  categories: PriorityCategoryRecord[]
  savingsGoals: SavingsGoal[]
  savingsAllocations: PeriodSavingsAllocation[]
  lastPeriodAllocations: PeriodSavingsAllocation[]
}

export default function PeriodDetailClient({
  period,
  expenses,
  linkedInvoices,
  manualIncome,
  allReceivedInvoices,
  settings,
  categories,
  savingsGoals,
  savingsAllocations,
  lastPeriodAllocations,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Build a lookup map: category name → color_key
  const categoryColorMap = new Map(categories.map(c => [c.name, c.color_key]))
  const [sortKey, setSortKey] = useState<SortKey>('priority_category')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [showInvoiceSelector, setShowInvoiceSelector] = useState(false)
  const [showManualIncomeForm, setShowManualIncomeForm] = useState(false)
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})
  const summaryCardsRef = useRef<HTMLDivElement>(null)
  const [showStickyBar, setShowStickyBar] = useState(false)

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
    period.deduction_overrides
  )
  const payNowTotal = calculatePayNowTotal(expenses)
  const accountBreakdown = calculateAccountBreakdown(expenses)
  const amountLeft = deductions.incomeAfterDeductions - payNowTotal

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

  const sortedExpenses = [...expenses].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    const aVal = a[sortKey] ?? ''
    const bVal = b[sortKey] ?? ''
    if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * mul
    return String(aVal).localeCompare(String(bVal)) * mul
  })

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
      const expense = expenses.find((e) => e.id === expenseId)
      if (expense?.debt_id || expense?.savings_goal_id) {
        startTransition(async () => {
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
    startTransition(() => updateExpenseField(expenseId, field, value))
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

  // ─── Deductions ──────────────────────────────────────────────
  const handleDeductionChange = (key: string, value: string) => {
    const parsed = value === '' ? null : parseFloat(value)
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
    startTransition(() => updateDeductionOverrides(period.id, updates))
  }

  const inputClass = 'bg-white border border-line rounded-[8px] px-2 py-1 text-sm focus:outline-none focus:border-blue transition-colors'
  const thClass = 'text-left text-caption font-bold uppercase text-text-muted px-3 py-2 whitespace-nowrap cursor-pointer hover:text-text-heading select-none'

  return (
    <div className="space-y-8">
      {/* ─── Summary Cards ─────────────────────────────────── */}
      <div ref={summaryCardsRef} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-line rounded-[20px] p-5">
          <div className="text-xs font-bold uppercase text-muted mb-1">Total Income</div>
          <div className="text-lg font-bold text-ink">{formatCurrency(period.income_amount)}</div>
        </div>
        <div className="bg-white border border-line rounded-[20px] p-5">
          <div className="text-xs font-bold uppercase text-muted mb-1">After Deductions</div>
          <div className="text-lg font-bold text-ink">{formatCurrency(deductions.incomeAfterDeductions)}</div>
        </div>
        <div className="bg-white border border-line rounded-[20px] p-5">
          <div className="text-xs font-bold uppercase text-muted mb-1">Pay Now Total</div>
          <div className="text-lg font-bold text-ink">{formatCurrency(payNowTotal)}</div>
        </div>
        <div className="bg-white border border-line rounded-[20px] p-5">
          <div className="text-xs font-bold uppercase text-muted mb-1">Amount Left</div>
          <div className={`text-lg font-bold ${amountLeft >= 0 ? 'text-green' : 'text-orange'}`}>
            {formatCurrency(amountLeft)}
          </div>
        </div>
      </div>

      {/* ─── Sticky Summary Bar (visible when scrolled past cards) ── */}
      {showStickyBar && (
        <div className="sticky top-0 z-40 -mx-6 px-6 -mt-4">
          <div className="bg-white/90 backdrop-blur-sm border border-line rounded-b-2xl shadow-sm px-4 py-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-muted">Income <span className="font-bold text-ink">{formatCurrency(period.income_amount)}</span></span>
              <span className="text-muted hidden sm:inline">After Ded. <span className="font-bold text-ink">{formatCurrency(deductions.incomeAfterDeductions)}</span></span>
              <span className="text-muted">Pay Now <span className="font-bold text-ink">{formatCurrency(payNowTotal)}</span></span>
            </div>
            <div className={`text-sm font-black ${amountLeft >= 0 ? 'text-green' : 'text-orange'}`}>
              {formatCurrency(amountLeft)} left
            </div>
          </div>
        </div>
      )}

      {/* ─── Income Section ────────────────────────────────── */}
      <div className="bg-white border border-line rounded-[20px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black font-display text-ink">Income</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowInvoiceSelector(!showInvoiceSelector)}
              className="text-xs bg-blue text-white rounded-[8px] px-3 py-1.5 font-bold hover:opacity-90"
            >
              Link Invoice
            </button>
            <button
              onClick={() => setShowManualIncomeForm(!showManualIncomeForm)}
              className="text-xs bg-white text-ink border border-line rounded-[8px] px-3 py-1.5 font-bold hover:border-blue"
            >
              + Manual
            </button>
          </div>
        </div>

        {/* Linked Invoices */}
        {linkedInvoices.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-bold text-muted uppercase mb-2">Linked Invoices</div>
            <div className="space-y-2">
              {linkedInvoices.map((li) => (
                <div key={li.id} className="flex items-center justify-between bg-cream-2 rounded-[10px] px-4 py-2">
                  <div>
                    <span className="text-sm font-bold text-ink">{li.invoices.client_name}</span>
                    {li.invoices.project_name && (
                      <span className="text-sm text-muted ml-2">– {li.invoices.project_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-ink">{formatCurrency(li.invoices.amount)}</span>
                    <button
                      onClick={() => handleUnlinkInvoice(li.invoice_id)}
                      disabled={isPending}
                      className="text-xs text-orange font-bold hover:underline"
                    >
                      Unlink
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Income */}
        {manualIncome.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-bold text-muted uppercase mb-2">Manual Income</div>
            <div className="space-y-2">
              {manualIncome.map((mi) => (
                <div key={mi.id} className="flex items-center justify-between bg-cream-2 rounded-[10px] px-4 py-2">
                  <span className="text-sm font-bold text-ink">{mi.description}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-ink">{formatCurrency(mi.amount)}</span>
                    <button
                      onClick={() => handleRemoveManualIncome(mi.id)}
                      disabled={isPending}
                      className="text-xs text-orange font-bold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invoice Selector Dropdown */}
        {showInvoiceSelector && (
          <div className="border border-line rounded-[12px] p-4 mb-4">
            <div className="text-xs font-bold text-muted uppercase mb-2">Select Received Invoices to Link</div>
            {allReceivedInvoices.filter((inv) => !linkedInvoiceIds.has(inv.id)).length === 0 ? (
              <p className="text-sm text-muted">No unlinked received invoices available.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {allReceivedInvoices
                  .filter((inv) => !linkedInvoiceIds.has(inv.id))
                  .map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between py-1">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) handleLinkInvoice(inv.id)
                          }}
                          className="rounded"
                        />
                        <span className="font-medium text-ink">{inv.client_name}</span>
                        {inv.project_name && <span className="text-muted">– {inv.project_name}</span>}
                      </label>
                      <span className="text-sm font-bold text-ink">{formatCurrency(inv.amount)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Manual Income Form */}
        {showManualIncomeForm && (
          <form onSubmit={handleAddManualIncome} className="flex gap-2 items-end border border-line rounded-[12px] p-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-muted mb-1">Description</label>
              <input type="text" name="description" required placeholder="e.g., Side project" className={inputClass + ' w-full'} />
            </div>
            <div className="w-32">
              <label className="block text-xs font-bold text-muted mb-1">Amount</label>
              <input type="number" name="amount" step="0.01" required placeholder="0.00" className={inputClass + ' w-full'} />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="bg-blue text-white rounded-[8px] px-4 py-1.5 text-sm font-bold hover:opacity-90 disabled:opacity-50"
            >
              Add
            </button>
          </form>
        )}

        <div className="text-right mt-3 pt-3 border-t border-line">
          <span className="text-sm text-muted">Total Income: </span>
          <span className="text-lg font-bold text-ink">{formatCurrency(period.income_amount)}</span>
        </div>
      </div>

      {/* ─── Deductions Grid ───────────────────────────────── */}
      <div className="bg-white border border-line rounded-[20px] p-6">
        <h2 className="text-xl font-black font-display text-ink mb-4">Deductions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-4">
          {[
            { pctKey: 'tithe_percentage', amtKey: 'tithe_amount', label: 'Tithe', detail: deductions.details.titheD },
            { pctKey: 'savings_percentage', amtKey: 'savings_amount', label: 'Savings', detail: deductions.details.savingsD },
            { pctKey: 'tax_percentage', amtKey: 'tax_amount', label: 'Tax', detail: deductions.details.taxD },
            { pctKey: 'profit_percentage', amtKey: 'profit_amount', label: 'Profit', detail: deductions.details.profitD },
            { pctKey: 'fun_money_percentage', amtKey: 'fun_money_amount', label: 'Fun Money', detail: deductions.details.funMoneyD },
          ].map(({ pctKey, amtKey, label, detail }) => {
            const hasOverride =
              period.deduction_overrides?.[pctKey as keyof DeductionOverrides] !== undefined ||
              period.deduction_overrides?.[amtKey as keyof DeductionOverrides] !== undefined
            return (
              <div key={pctKey} className="text-center">
                <div className="text-xs font-bold text-muted uppercase mb-1">{label}</div>
                {/* % | $ toggle */}
                <div className="flex justify-center mb-1">
                  <div className="flex rounded-[6px] border border-line overflow-hidden">
                    <button
                      onClick={() => handleDeductionModeToggle(pctKey, amtKey, detail, '%')}
                      className={`px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                        detail.mode === '%' ? 'bg-ink text-white' : 'text-muted hover:text-ink'
                      }`}
                    >
                      %
                    </button>
                    <button
                      onClick={() => handleDeductionModeToggle(pctKey, amtKey, detail, '$')}
                      className={`px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                        detail.mode === '$' ? 'bg-ink text-white' : 'text-muted hover:text-ink'
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
                    onChange={(e) => handleDeductionChange(
                      detail.mode === '%' ? pctKey : amtKey,
                      e.target.value
                    )}
                    className={`w-20 text-center text-sm font-bold rounded-[8px] border px-2 py-1 focus:outline-none focus:border-blue ${
                      hasOverride ? 'border-blue bg-blue/5' : 'border-line'
                    }`}
                  />
                  <span className="text-xs text-muted">{detail.mode === '%' ? '%' : '$'}</span>
                </div>
                {detail.mode === '%' ? (
                  <div className="text-sm font-bold text-ink">{formatCurrency(detail.amount)}</div>
                ) : (
                  <div className="text-[10px] text-muted">= {detail.percentage.toFixed(1)}%</div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between items-center pt-4 border-t border-line">
          <div>
            <span className="text-sm text-muted">Total Deductions: </span>
            <span className="font-bold text-ink">{formatCurrency(deductions.total)}</span>
          </div>
          <div>
            <span className="text-sm text-muted">After Deductions: </span>
            <span className="font-bold text-ink">{formatCurrency(deductions.incomeAfterDeductions)}</span>
          </div>
        </div>
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
        />
      )}

      {/* ─── Account Transfer Summary ──────────────────────── */}
      {Object.keys(accountBreakdown).length > 0 && (
        <div>
          <h2 className="text-xl font-black font-display text-ink mb-4">Account Transfers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(accountBreakdown).map(([account, total]) => (
              <div key={account} className="bg-white border border-line rounded-[20px] p-5">
                <div className="text-xs font-bold uppercase text-muted mb-1">{account}</div>
                <div className="text-lg font-bold text-ink">{formatCurrency(total)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Expenses Table ────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-black font-display text-ink mb-4">
          Expenses
          <span className="text-sm font-medium text-muted ml-2">
            ({expenses.filter((e) => e.pay_now).length} marked pay now)
          </span>
        </h2>

        <div className="rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-[#c9e5e4]">
                  <th className="text-center px-3 py-2 text-caption font-bold uppercase text-text-muted w-10">Pay</th>
                  <th className={thClass} onClick={() => handleSort('name')}>
                    Name<SortIcon col="name" />
                  </th>
                  <th className={thClass} onClick={() => handleSort('default_amount')}>
                    Amount<SortIcon col="default_amount" />
                  </th>
                  <th className="text-center px-3 py-2 text-caption font-bold uppercase text-text-muted">Pay Amt</th>
                  <th className={thClass} onClick={() => handleSort('account')}>
                    Account<SortIcon col="account" />
                  </th>
                  <th className={thClass} onClick={() => handleSort('priority_category')}>
                    Priority<SortIcon col="priority_category" />
                  </th>
                  <th className={thClass} onClick={() => handleSort('due_day')}>
                    Due<SortIcon col="due_day" />
                  </th>
                  <th className="text-center px-3 py-2 text-caption font-bold uppercase text-text-muted">Xfer</th>
                  <th className="text-center px-3 py-2 text-caption font-bold uppercase text-text-muted">Paid</th>
                  <th className="text-center px-3 py-2 text-caption font-bold uppercase text-text-muted">Clear</th>
                </tr>
              </thead>
              <tbody>
                {sortedExpenses.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    isPending={isPending}
                    onCheckboxChange={handleCheckboxChange}
                    onDebouncedUpdate={debouncedUpdate}
                    inputClass={inputClass}
                    categoryColorMap={categoryColorMap}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-[#c9e5e4]">
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 font-bold text-ink text-sm">Pay Now Total</td>
                  <td className="px-3 py-3 font-bold text-ink text-sm">{formatCurrency(payNowTotal)}</td>
                  <td colSpan={7} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Back Button ───────────────────────────────────── */}
      <div className="pt-4">
        <button
          onClick={() => router.push('/periods')}
          className="text-sm text-blue font-bold hover:underline"
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
  onCheckboxChange,
  onDebouncedUpdate,
  inputClass,
  categoryColorMap,
}: {
  expense: PeriodExpense
  isPending: boolean
  onCheckboxChange: (id: string, field: string, value: boolean) => void
  onDebouncedUpdate: (id: string, field: string, value: boolean | number | string | null) => void
  inputClass: string
  categoryColorMap: Map<string, string>
}) {
  const owedAmount = getOwedAmount(expense)
  const effectiveAmount = getEffectiveAmount(expense)
  const hasOverride = expense.amount_override !== null && expense.amount_override !== undefined

  return (
    <tr className={`transition-colors ${expense.pay_now ? 'bg-primary-teal/[0.15] hover:bg-[#E1DEEC]' : 'odd:bg-bg-white even:bg-[#E8F5F4] hover:bg-[#E1DEEC]'}`}>
      {/* PayNow */}
      <td className="text-center px-3 py-2">
        <input
          type="checkbox"
          checked={expense.pay_now}
          onChange={(e) => onCheckboxChange(expense.id, 'pay_now', e.target.checked)}
          disabled={isPending}
          className="rounded"
        />
      </td>

      {/* Name */}
      <td className="px-3 py-2">
        {expense.base_item_id ? (
          <Link
            href={`/base-budget?edit=${expense.base_item_id}`}
            className="font-medium text-ink hover:text-blue hover:underline transition-colors"
          >
            {expense.name}
          </Link>
        ) : (
          <div className="font-medium text-ink">{expense.name}</div>
        )}
        {expense.auto_pay && (
          <span className="text-[10px] bg-green/10 text-green px-1.5 py-0.5 rounded font-bold">AUTO</span>
        )}
        {expense.pay_url && (
          <a
            href={expense.pay_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-blue ml-1 font-bold hover:underline"
          >
            PAY →
          </a>
        )}
      </td>

      {/* Amount */}
      <td className="px-3 py-2">
        <input
          type="number"
          step="0.01"
          defaultValue={hasOverride ? expense.amount_override! : expense.default_amount}
          onChange={(e) => {
            const val = e.target.value === '' ? null : parseFloat(e.target.value)
            if (val === expense.default_amount) {
              onDebouncedUpdate(expense.id, 'amount_override', null)
            } else {
              onDebouncedUpdate(expense.id, 'amount_override', val)
            }
          }}
          className={`w-24 text-right ${inputClass} ${hasOverride ? 'border-blue bg-blue/5' : ''}`}
        />
        {hasOverride && (
          <div className="text-[10px] text-muted mt-0.5">
            default: {formatCurrency(expense.default_amount)}
          </div>
        )}
      </td>

      {/* Pay Amt — what you're actually paying this period (overrides Amount for budget calc) */}
      <td className="px-3 py-2">
        <div className="min-w-0">
          <input
            type="number"
            step="0.01"
            placeholder="—"
            defaultValue={expense.paid_amount > 0 ? expense.paid_amount : ''}
            onChange={(e) => {
              const val = e.target.value === '' ? 0 : parseFloat(e.target.value)
              onDebouncedUpdate(expense.id, 'paid_amount', val)
              // Auto-check paid when pay amount covers the full owed amount
              if (val >= owedAmount && !expense.paid) {
                onCheckboxChange(expense.id, 'paid', true)
              }
            }}
            className={`w-20 text-right text-xs ${inputClass} ${
              expense.paid_amount > 0 && expense.paid_amount < owedAmount
                ? 'border-orange bg-orange/5'
                : expense.paid_amount >= owedAmount
                  ? 'border-green bg-green/5'
                  : ''
            }`}
          />
          {expense.paid_amount > 0 && expense.paid_amount < owedAmount && (
            <div className="text-[10px] text-orange font-bold mt-0.5 whitespace-nowrap">
              {formatCurrency(owedAmount - expense.paid_amount)} remaining
            </div>
          )}
        </div>
      </td>

      {/* Account */}
      <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">{expense.account || '—'}</td>

      {/* Priority */}
      <td className="px-3 py-2">
        {expense.priority_category && (
          <span className={`inline-block max-w-[120px] truncate px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getPriorityColor(categoryColorMap.get(expense.priority_category))}`}>
            {expense.priority_category}
          </span>
        )}
      </td>

      {/* Due Day */}
      <td className="px-3 py-2 text-xs text-muted text-center">{expense.due_day || '—'}</td>

      {/* Transferred */}
      <td className="text-center px-3 py-2">
        <input
          type="checkbox"
          checked={expense.transferred}
          onChange={(e) => onCheckboxChange(expense.id, 'transferred', e.target.checked)}
          disabled={isPending}
          className="rounded"
        />
      </td>

      {/* Paid */}
      <td className="text-center px-3 py-2">
        <input
          type="checkbox"
          checked={expense.paid}
          onChange={(e) => onCheckboxChange(expense.id, 'paid', e.target.checked)}
          disabled={isPending}
          className="rounded"
        />
      </td>

      {/* Cleared */}
      <td className="text-center px-3 py-2">
        <input
          type="checkbox"
          checked={expense.cleared}
          onChange={(e) => onCheckboxChange(expense.id, 'cleared', e.target.checked)}
          disabled={isPending}
          className="rounded"
        />
      </td>
    </tr>
  )
}
