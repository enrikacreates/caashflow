import { calculateDeductions, getDeductionBases } from './calculations'
import type {
  BudgetSession,
  DeductionKey,
  IncomeType,
  Invoice,
  PeriodAdjustment,
  PeriodExpense,
  PeriodManualIncome,
  Settings,
} from './types'

export interface LinkedInvoiceRow {
  id: string
  period_id: string
  invoice_id: string
  is_done: boolean
  session_id: string | null
  income_type: IncomeType
  skip_deductions: DeductionKey[]
  invoices: Invoice
}

/** Tab label: "Aug 15: S2", or "Aug 15: Payday" once renamed. */
export function sessionLabel(session: Pick<BudgetSession, 'seq' | 'name' | 'session_date'>): string {
  const [y, m, d] = session.session_date.split('-').map(Number)
  const date = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${date}: ${session.name?.trim() || `S${session.seq}`}`
}

/** Today as YYYY-MM-DD in the viewer's timezone (session dates are calendar days). */
export function localToday(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** A session's income items: its manual income plus received linked invoices. */
export function sessionIncomeItems(
  sessionId: string,
  manualIncome: PeriodManualIncome[],
  linkedInvoices: LinkedInvoiceRow[]
) {
  const manual = manualIncome
    .filter((mi) => mi.session_id === sessionId)
    .map((mi) => ({ amount: mi.amount, skip_deductions: mi.skip_deductions }))
  const linked = linkedInvoices
    .filter((li) => li.session_id === sessionId && li.invoices.status === 'received')
    .map((li) => ({ amount: li.invoices.amount, skip_deductions: li.skip_deductions }))
  return [...manual, ...linked]
}

/** Income, per-income deductions, and adjustments for one session. */
export function summarizeSession(
  session: BudgetSession,
  data: {
    manualIncome: PeriodManualIncome[]
    linkedInvoices: LinkedInvoiceRow[]
    adjustments: PeriodAdjustment[]
  },
  settings: Settings
) {
  const items = sessionIncomeItems(session.id, data.manualIncome, data.linkedInvoices)
  const income = items.reduce((s, i) => s + i.amount, 0)
  const deductions = calculateDeductions(income, settings, session.deduction_overrides, getDeductionBases(items))
  const adjustment = data.adjustments
    .filter((a) => a.session_id === session.id)
    .reduce((s, a) => s + (a.amount || 0), 0)
  return { income, deductions, adjustment, toBudget: deductions.incomeAfterDeductions + adjustment }
}

/**
 * Bills a session tab shows: the ones its income funded, plus (newest session
 * only) the month's still-unfunded bills so they can be pulled in. Split bills
 * keep only the installments that belong to this view.
 */
export function expensesForSession(expenses: PeriodExpense[], sessionId: string, isNewest: boolean): PeriodExpense[] {
  const inView = (id: string | null) => id === sessionId || (isNewest && id === null)
  const result: PeriodExpense[] = []
  for (const e of expenses) {
    if (e.is_split) {
      const payments = (e.payments ?? []).filter((p) => inView(p.session_id))
      if (payments.length > 0 || (isNewest && (e.payments ?? []).length === 0)) result.push({ ...e, payments })
    } else if (inView(e.session_id)) {
      result.push(e)
    }
  }
  return result
}
