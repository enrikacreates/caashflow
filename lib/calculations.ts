import type { Settings, DeductionOverrides, PeriodExpense, PeriodSavingsAllocation, BaseBudgetItem } from './types'
import { getOwedAmount } from './utils'

export function getEffectivePercentage(
  overrides: DeductionOverrides | null | undefined,
  settings: Settings,
  key: keyof DeductionOverrides
): number {
  const override = overrides?.[key]
  if (override !== null && override !== undefined) return override
  const settingsKey = key as keyof Settings
  return settings[settingsKey] as number
}

export type DeductionMode = '%' | '$'

export interface EffectiveDeduction {
  amount: number
  mode: DeductionMode
  value: number // the raw input value (percentage or dollar amount)
  percentage: number // always the effective percentage for display
}

/**
 * Resolve a single deduction. Dollar-amount override takes precedence over
 * percentage override, which takes precedence over the household settings default.
 */
export function getEffectiveDeduction(
  income: number,
  overrides: DeductionOverrides | null | undefined,
  settings: Settings,
  percentKey: keyof DeductionOverrides,
  amountKey: keyof DeductionOverrides
): EffectiveDeduction {
  // 1. Check for dollar-amount override first.
  //    A fixed $ deduction only applies when there's income to take it from — with
  //    no active income (e.g. after a settle & reset) it's $0, not the standing override.
  const dollarOverride = overrides?.[amountKey]
  if (dollarOverride !== null && dollarOverride !== undefined) {
    return {
      amount: income > 0 ? dollarOverride : 0,
      mode: '$',
      value: dollarOverride,
      percentage: income > 0 ? (dollarOverride / income) * 100 : 0,
    }
  }

  // 2. Check percentage override, then fall back to settings
  const pct = getEffectivePercentage(overrides, settings, percentKey)
  return {
    amount: income * (pct / 100),
    mode: '%',
    value: pct,
    percentage: pct,
  }
}

export function calculateDeductions(
  income: number,
  settings: Settings,
  overrides?: DeductionOverrides | null
) {
  const titheD = getEffectiveDeduction(income, overrides, settings, 'tithe_percentage', 'tithe_amount')
  const savingsD = getEffectiveDeduction(income, overrides, settings, 'savings_percentage', 'savings_amount')
  const taxD = getEffectiveDeduction(income, overrides, settings, 'tax_percentage', 'tax_amount')
  const profitD = getEffectiveDeduction(income, overrides, settings, 'profit_percentage', 'profit_amount')
  const funMoneyD = getEffectiveDeduction(income, overrides, settings, 'fun_money_percentage', 'fun_money_amount')

  const tithe = titheD.amount
  const savings = savingsD.amount
  const taxes = taxD.amount
  const profit = profitD.amount
  const funMoney = funMoneyD.amount

  return {
    tithe,
    savings,
    taxes,
    profit,
    funMoney,
    total: tithe + savings + taxes + profit + funMoney,
    incomeAfterDeductions: income - tithe - savings - taxes - profit - funMoney,
    percentages: {
      titheP: titheD.percentage,
      savingsP: savingsD.percentage,
      taxP: taxD.percentage,
      profitP: profitD.percentage,
      funMoneyP: funMoneyD.percentage,
    },
    details: { titheD, savingsD, taxD, profitD, funMoneyD },
  }
}

export function calculateAllocationTotals(allocations: PeriodSavingsAllocation[]) {
  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0)
  const totalContributed = allocations.reduce((sum, a) => sum + a.contributed, 0)
  const hasPendingDeltas = allocations.some((a) => a.amount !== a.contributed)
  return { totalAllocated, totalContributed, hasPendingDeltas }
}

/**
 * Booked spend on a line ("spent so far" for the draw-down readout).
 *   Split  → sum of paid sub-payments
 *   Single → paid_amount, the cached booked total (grows as spends are logged;
 *            topped up to the funded amount once the line clears)
 */
export function getSpentSoFar(expense: PeriodExpense): number {
  if (expense.is_split) {
    return (expense.payments ?? [])
      .filter((p) => p.paid)
      .reduce((sum, p) => sum + p.amount, 0)
  }
  return expense.paid_amount ?? 0
}

/**
 * What's left to spend on a line: funded amount minus booked spend.
 * Can go negative when overspent (caller decides whether to clamp for display).
 */
export function getRemainingToSpend(expense: PeriodExpense): number {
  return getOwedAmount(expense) - getSpentSoFar(expense)
}

/** How much of an expense counts as paid in the roundup — same as booked spend. */
export function getPaidSoFar(expense: PeriodExpense): number {
  return getSpentSoFar(expense)
}

/** Whether an expense is fully settled (handles split + single). */
export function isFullyPaid(expense: PeriodExpense): boolean {
  if (expense.is_split) {
    const payments = expense.payments ?? []
    return payments.length > 0 && getPaidSoFar(expense) >= getOwedAmount(expense)
  }
  return expense.paid
}

/**
 * The amount an expense commits to the budget this period — the "Pay" decision.
 *   Split  → sum of sub-payments whose Pay box is checked
 *   Single → the full owed amount when Pay is checked, else 0
 * Independent of "paid": paying is bookkeeping, scheduling (Pay) is what budgets.
 */
export function getBudgetedAmount(expense: PeriodExpense): number {
  if (expense.is_complete) return 0 // settled (via Clear) — out of the live balance
  if (expense.is_split) {
    return (expense.payments ?? [])
      .filter((p) => p.pay_now)
      .reduce((sum, p) => sum + p.amount, 0)
  }
  return expense.pay_now ? getOwedAmount(expense) : 0
}

/** Total committed against this period's income (zero-based budgeting). */
export function calculatePayNowTotal(expenses: PeriodExpense[]): number {
  return expenses.reduce((sum, e) => sum + getBudgetedAmount(e), 0)
}

/** Period-level rollup: what's budgeted, what's actually been paid (informational), and how many bills are scheduled. */
export function calculatePeriodPaymentSummary(expenses: PeriodExpense[]) {
  const budgeted = expenses.reduce((sum, e) => sum + getBudgetedAmount(e), 0)
  const paid = expenses.reduce((sum, e) => sum + getPaidSoFar(e), 0)
  const scheduledBills = expenses.filter((e) => getBudgetedAmount(e) > 0).length
  return { budgeted, paid, scheduledBills }
}

export interface AccountAllocation {
  account: string | null
  amount: number
}

export function calculateAccountBreakdown(
  expenses: PeriodExpense[],
  extraAllocations: AccountAllocation[] = []
): Record<string, number> {
  const breakdown: Record<string, number> = {}
  expenses.forEach((e) => {
    const amount = getBudgetedAmount(e)
    if (amount <= 0) return
    const account = e.account || 'Unknown'
    breakdown[account] = (breakdown[account] || 0) + amount
  })
  // Fold in deductions (or any other allocation) that are assigned to an account
  extraAllocations.forEach(({ account, amount }) => {
    if (!account || amount <= 0) return
    breakdown[account] = (breakdown[account] || 0) + amount
  })
  return breakdown
}

export interface AccountTransferDetail {
  /** Live amount still sitting against this account (uncleared pay-now + deductions). */
  remaining: number
  /** Zero-based starting amount — everything committed incl. items already cleared. */
  original: number
  /** Uncleared expense portion only — used to decide whether to show the "started" note. */
  expenseRemaining: number
}

/**
 * Per-account transfer figures. `remaining` draws down as expenses clear;
 * `original` is the zero-based starting amount (kept for reference until the
 * account's expenses are all cleared). Deductions count toward both and don't draw down.
 */
export function calculateAccountTransferDetail(
  expenses: PeriodExpense[],
  extraAllocations: AccountAllocation[] = []
): Record<string, AccountTransferDetail> {
  const out: Record<string, AccountTransferDetail> = {}
  const slot = (a: string) => (out[a] ??= { remaining: 0, original: 0, expenseRemaining: 0 })

  expenses.forEach((e) => {
    const account = e.account || 'Unknown'
    const remaining = getBudgetedAmount(e) // 0 once cleared (is_complete)
    // Committed toward the transfer — counts cleared items at their owed amount.
    const committed = e.is_complete ? getOwedAmount(e) : remaining
    if (committed <= 0 && remaining <= 0) return
    const s = slot(account)
    s.remaining += remaining
    s.original += committed
    s.expenseRemaining += remaining
  })

  extraAllocations.forEach(({ account, amount }) => {
    if (!account || amount <= 0) return
    const s = slot(account)
    s.remaining += amount
    s.original += amount
  })

  return out
}

/** Map each deduction to the account it's set aside into (from settings). */
export function getDeductionAccountAllocations(
  deductions: ReturnType<typeof calculateDeductions>,
  settings: Settings
): AccountAllocation[] {
  return [
    { account: settings.tithe_account, amount: deductions.tithe },
    { account: settings.savings_account, amount: deductions.savings },
    { account: settings.tax_account, amount: deductions.taxes },
    { account: settings.profit_account, amount: deductions.profit },
    { account: settings.fun_money_account, amount: deductions.funMoney },
  ]
}

/**
 * Normalize all base budget items to a monthly equivalent.
 *   Monthly  → as-is
 *   Weekly   → × (52 / 12)
 *   Annually → ÷ 12
 *   One-Time → excluded (not recurring)
 */
export function calculateMonthlyEquivalent(items: BaseBudgetItem[]): number {
  return items.reduce((sum, item) => {
    switch (item.frequency) {
      case 'Monthly':  return sum + item.default_amount
      case 'Weekly':   return sum + item.default_amount * (52 / 12)
      case 'Annually': return sum + item.default_amount / 12
      case 'One-Time': return sum
      default:         return sum
    }
  }, 0)
}

export function getNext6Months(): string[] {
  const months: string[] = []
  const today = new Date()
  for (let i = 0; i < 6; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    months.push(`${year}-${month}`)
  }
  return months
}
