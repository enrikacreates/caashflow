import { getOwedAmount } from './utils'
import { budgetLineFor, expenseLabel } from './annual'
import type { BaseBudgetItem, BillPayment, PeriodExpense, PeriodExpensePayment } from './types'

export type UpcomingStatus = 'unfunded' | 'funded' | 'paid' | 'baseline'

/** The one budget that speaks for a calendar month ("YYYY-MM"). */
export interface UpcomingBudget {
  month: string
  periodId: string
  expenses: (PeriodExpense & { payments: PeriodExpensePayment[] })[]
}

export interface UpcomingBill {
  key: string
  // What tapping the bill opens: a budget line, or the baseline item when there's no budget yet
  edit: { kind: 'expense'; expense: PeriodExpense; month: string } | { kind: 'base'; item: BaseBudgetItem; month: string }
  name: string
  amount: number
  status: UpcomingStatus
  isSplitPart?: boolean
  annual: boolean
  autoPay: boolean
  account: string | null
}

export interface UpcomingDay {
  date: string
  offset: number
  total: number
  bills: UpcomingBill[]
}

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** A due day of 31 lands on the month's last day in shorter months. */
function dueDayFor(dueDay: number, year: number, monthIndex: number): number {
  return Math.min(dueDay, new Date(year, monthIndex + 1, 0).getDate())
}

/** Bills still to be dealt with on a given due day, from one budget. */
function billsFromBudget(budget: UpcomingBudget, matches: (dueDay: number) => boolean): UpcomingBill[] {
  const bills: UpcomingBill[] = []
  for (const e of budget.expenses) {
    if (e.is_complete) continue
    if (e.is_split && e.payments.length > 0) {
      for (const p of e.payments) {
        const due = p.due_day ?? e.due_day
        if (p.cleared || due == null || !matches(due)) continue
        bills.push({
          key: p.id,
          isSplitPart: true,
          edit: { kind: 'expense', expense: e, month: budget.month },
          name: p.label ? `${e.name}: ${p.label}` : e.name,
          annual: e.frequency === 'Annually',
          amount: p.amount,
          status: p.paid ? 'paid' : p.pay_now || p.session_id ? 'funded' : 'unfunded',
          autoPay: e.auto_pay,
          account: e.account,
        })
      }
    } else if (!e.cleared && e.due_day != null && matches(e.due_day)) {
      bills.push({
        key: e.id,
        edit: { kind: 'expense', expense: e, month: budget.month },
        name: expenseLabel(e),
        annual: e.frequency === 'Annually',
        amount: getOwedAmount(e),
        status: e.paid ? 'paid' : e.pay_now || e.session_id ? 'funded' : 'unfunded',
        autoPay: e.auto_pay,
        account: e.account,
      })
    }
  }
  return bills
}

/**
 * Bills due from `today` through the next `days` days, grouped by date. Each date
 * reads from its own month's budget, so a week can run across two months; a month
 * with no budget yet falls back to the monthly bills in the baseline.
 */
export function upcomingBillsByDay(
  today: string,
  budgets: UpcomingBudget[],
  baseItems: BaseBudgetItem[],
  waitingPayments: Pick<BillPayment, 'base_item_id' | 'for_month'>[] = [],
  days = 7
): UpcomingDay[] {
  const [y, m, d] = today.split('-').map(Number)
  const result: UpcomingDay[] = []
  for (let offset = 0; offset < days; offset++) {
    const date = new Date(y, m - 1, d + offset)
    const iso = toISO(date)
    const [year, monthIndex, dayOfMonth] = [date.getFullYear(), date.getMonth(), date.getDate()]
    const matches = (dueDay: number) => dueDayFor(dueDay, year, monthIndex) === dayOfMonth

    const budget = budgets.find((b) => b.month === iso.slice(0, 7))
    const bills: UpcomingBill[] = budget
      ? billsFromBudget(budget, matches)
      : baseItems
          .filter((i) => (i.frequency === 'Monthly' || (i.frequency === 'Annually' && budgetLineFor(i, monthIndex) !== null && !!i.due_month)) && i.due_day != null && matches(i.due_day))
          // Already paid ahead of this month's budget
          .filter((i) => !waitingPayments.some((p) => p.base_item_id === i.id && p.for_month === `${iso.slice(0, 7)}-01`))
          .map((i) => ({ key: `base-${i.id}-${iso}`, edit: { kind: 'base' as const, item: i, month: iso.slice(0, 7) }, name: i.name, annual: i.frequency === 'Annually', amount: budgetLineFor(i, monthIndex)?.amount ?? i.default_amount, status: 'baseline' as const, autoPay: i.auto_pay, account: i.account }))

    if (bills.length > 0) {
      bills.sort((a, b) => b.amount - a.amount)
      result.push({ date: iso, offset, total: bills.reduce((s, b) => s + b.amount, 0), bills })
    }
  }
  return result
}

/**
 * Bills earlier this month that were never paid, oldest first. Only this month's
 * budget counts: monthly bills are recreated each month, so last month's leftovers
 * would double up (a real carry-over gets flagged overdue on the new budget).
 */
export function pastDueBillsByDay(today: string, budgets: UpcomingBudget[]): UpcomingDay[] {
  const budget = budgets.find((b) => b.month === today.slice(0, 7))
  if (!budget) return []
  const [y, m, d] = today.split('-').map(Number)
  const result: UpcomingDay[] = []
  for (let day = 1; day < d; day++) {
    const matches = (dueDay: number) => dueDayFor(dueDay, y, m - 1) === day
    const bills = billsFromBudget(budget, matches).filter((b) => b.status !== 'paid')
    if (bills.length > 0) {
      bills.sort((a, b) => b.amount - a.amount)
      result.push({ date: toISO(new Date(y, m - 1, day)), offset: day - d, total: bills.reduce((s, b) => s + b.amount, 0), bills })
    }
  }
  return result
}
