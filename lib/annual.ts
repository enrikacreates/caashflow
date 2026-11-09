import type { BaseBudgetItem, BillPayment, PeriodExpense } from './types'

/** How many months ahead an annual bill shows when it has no setting of its own. */
export const DEFAULT_ANNUAL_NOTICE_MONTHS = 2

const round2 = (n: number) => Math.round(n * 100) / 100

/** Whole months from `monthIndex` (0-11) until `dueMonth` (1-12); 0 = due this month. */
export function monthsUntilDue(dueMonth: number, monthIndex: number): number {
  return (dueMonth - 1 - monthIndex + 12) % 12
}

type AnnualFields = Pick<BaseBudgetItem, 'frequency' | 'default_amount' | 'due_month' | 'split_months'>

/**
 * What a baseline item puts in a given month's budget, or null for nothing. Monthly bills
 * and annual bills with no due month go in every month; annual bills go in their due month,
 * or the months of their split. The last part absorbs any rounding so parts add up exactly.
 */
export function budgetLineFor(item: AnnualFields, monthIndex: number): { amount: number; part: number | null; parts: number | null } | null {
  if (item.frequency !== 'Annually' || !item.due_month) return { amount: item.default_amount, part: null, parts: null }
  const parts = item.split_months ?? 1
  const away = monthsUntilDue(item.due_month, monthIndex)
  if (away >= parts) return null
  if (parts === 1) return { amount: item.default_amount, part: null, parts: null }
  const each = round2(item.default_amount / parts)
  return {
    amount: away === 0 ? round2(item.default_amount - each * (parts - 1)) : each,
    part: parts - away,
    parts,
  }
}

/** Display name of a budget line: "Car Tags (1 of 3)" for part of a split. */
export function expenseLabel(e: Pick<PeriodExpense, 'name' | 'annual_part' | 'annual_parts'>): string {
  return e.annual_part && e.annual_parts ? `${e.name} (${e.annual_part} of ${e.annual_parts})` : e.name
}

export interface AnnualComingUp {
  item: BaseBudgetItem
  // null = no due month set yet
  monthsAway: number | null
  // What's owed in the current month, when anything is
  amountNow: number | null
  part: number | null
  parts: number | null
}

/**
 * Annual bills to flag on the dashboard: within their notice window, or missing a due
 * month. A bill drops off for the month once this month's line is settled.
 */
export function annualComingUp(
  today: string,
  baseItems: BaseBudgetItem[],
  currentLines: Pick<PeriodExpense, 'base_item_id' | 'cleared' | 'is_complete' | 'paid_outside'>[],
  waitingPayments: Pick<BillPayment, 'base_item_id' | 'for_month'>[]
): AnnualComingUp[] {
  const monthIndex = Number(today.slice(5, 7)) - 1
  const monthKey = `${today.slice(0, 7)}-01`
  const result: AnnualComingUp[] = []
  for (const item of baseItems) {
    if (item.frequency !== 'Annually') continue
    if (!item.due_month) {
      result.push({ item, monthsAway: null, amountNow: null, part: null, parts: null })
      continue
    }
    const settled =
      currentLines.some((l) => l.base_item_id === item.id && (l.cleared || l.is_complete || l.paid_outside)) ||
      waitingPayments.some((p) => p.base_item_id === item.id && p.for_month === monthKey)
    if (settled) continue

    const monthsAway = monthsUntilDue(item.due_month, monthIndex)
    const line = budgetLineFor(item, monthIndex)
    if (monthsAway > (item.remind_months ?? DEFAULT_ANNUAL_NOTICE_MONTHS) && !line) continue
    result.push({ item, monthsAway, amountNow: line?.amount ?? null, part: line?.part ?? null, parts: line?.parts ?? null })
  }
  return result.sort((a, b) => (a.monthsAway ?? 99) - (b.monthsAway ?? 99))
}
