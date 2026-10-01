'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserTeamId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'

// ── Period CRUD ─────────────────────────────────────────────────────────────
// Period-level operations only. For expense/income/invoice actions within a
// period, see period-expenses.ts. For data export/import, see team.ts.

/** Manual income summed by "YYYY-MM" (a period's month), excluding rows flagged out of reports. Feeds the income chart. */
export async function getMonthlyManualIncome(): Promise<Record<string, number>> {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { data, error } = await supabase
    .from('period_manual_income')
    .select('amount, budget_periods ( period_month )')
    .eq('team_id', teamId)
    .eq('exclude_from_reports', false)

  if (error) throw new Error(`Failed to fetch manual income: ${error.message}`)

  const byMonth: Record<string, number> = {}
  for (const row of data ?? []) {
    const period = row.budget_periods as unknown as { period_month: string | null } | null
    const month = period?.period_month?.slice(0, 7)
    if (!month) continue
    byMonth[month] = (byMonth[month] ?? 0) + (Number(row.amount) || 0)
  }
  return byMonth
}

export async function getBudgetPeriods() {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { data, error } = await supabase
    .from('budget_periods')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch budget periods: ${error.message}`)
  return data
}

export async function createBudgetPeriod(formData: FormData) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const periodName = formData.get('period_name') as string
  const periodMonthRaw = formData.get('period_month') as string | null
  const kindRaw = (formData.get('kind') as string | null) ?? 'monthly'
  const kind: 'monthly' | 'event' = kindRaw === 'event' ? 'event' : 'monthly'
  // period_month arrives as "YYYY-MM" from <input type="month"> — store as first-of-month date.
  // Event budgets aren't month-anchored, so leave null.
  const periodMonth = kind === 'event'
    ? null
    : (periodMonthRaw ? `${periodMonthRaw}-01` : null)

  const { data: period, error: periodError } = await supabase
    .from('budget_periods')
    .insert({
      team_id: teamId,
      period_name: periodName,
      period_month: periodMonth,
      kind,
      income_amount: 0,
      deduction_overrides: {},
    })
    .select()
    .single()

  if (periodError) throw new Error(`Failed to create budget period: ${periodError.message}`)

  // Event budgets start empty — base items only seed monthly periods.
  if (kind === 'event') {
    revalidatePath('/periods')
    return
  }

  // Copy base budget items into the new period as expenses
  const { data: baseItems, error: baseError } = await supabase
    .from('base_budget_items')
    .select('*')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true })

  if (baseError) throw new Error(`Failed to fetch base budget items: ${baseError.message}`)

  if (baseItems && baseItems.length > 0) {
    const periodExpenses = baseItems.map((item, index) => ({
      period_id: period.id,
      team_id: teamId,
      base_item_id: item.id,
      name: item.name,
      default_amount: item.default_amount,
      due_day: item.due_day,
      account: item.account,
      priority_category: item.priority_category,
      frequency: item.frequency,
      auto_pay: item.auto_pay,
      pay_url: item.pay_url,
      notes: item.notes,
      tags: item.tags || [],
      debt_id: item.debt_id ?? null,
      savings_goal_id: item.savings_goal_id ?? null,
      track_spending: item.track_spending ?? false,
      pay_now: false,
      transferred: false,
      paid: false,
      cleared: false,
      amount_override: null,
      override_notes: null,
      paid_amount: 0,
      sort_order: item.sort_order ?? index,
    }))

    const { error: expensesError } = await supabase
      .from('period_expenses')
      .insert(periodExpenses)

    if (expensesError) throw new Error(`Failed to create period expenses: ${expensesError.message}`)
  }

  revalidatePath('/periods')
}

/** Edit a budget's name, month, kind, and/or created date. */
export async function updateBudgetPeriod(
  id: string,
  fields: {
    period_name: string
    period_month: string | null
    kind?: 'monthly' | 'event'
    created_at?: string
  }
) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  // Event budgets aren't month-anchored — clear the month if converting to event.
  const periodMonth = fields.kind === 'event'
    ? null
    : (fields.period_month
        ? (fields.period_month.length === 7 ? `${fields.period_month}-01` : fields.period_month)
        : null)

  const updates: Record<string, unknown> = {
    period_name: fields.period_name,
    period_month: periodMonth,
    updated_at: new Date().toISOString(),
  }
  if (fields.kind) updates.kind = fields.kind
  if (fields.created_at) updates.created_at = fields.created_at

  const { error } = await supabase
    .from('budget_periods')
    .update(updates)
    .eq('id', id)
    .eq('team_id', teamId)
  if (error) throw new Error(`Failed to update budget: ${error.message}`)

  revalidatePath('/periods')
  revalidatePath('/')
  revalidatePath(`/periods/${id}`)
}

/**
 * Toggle whether an event budget applies deductions (tithe/savings/tax/profit/
 * giving) + account transfers. No-op flag for monthly budgets, which always deduct.
 */
export async function setPeriodApplyDeductions(id: string, value: boolean) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { error } = await supabase
    .from('budget_periods')
    .update({ apply_deductions: value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('team_id', teamId)

  if (error) throw new Error(`Failed to update deductions setting: ${error.message}`)

  revalidatePath(`/periods/${id}`)
  revalidatePath('/periods')
  revalidatePath('/')
}

export async function completePeriod(id: string) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { error } = await supabase
    .from('budget_periods')
    .update({ status: 'complete', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('team_id', teamId)

  if (error) throw new Error(`Failed to complete period: ${error.message}`)

  revalidatePath(`/periods/${id}`)
  revalidatePath('/periods')
  revalidatePath('/')
}

export async function reopenPeriod(id: string) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { error } = await supabase
    .from('budget_periods')
    .update({ status: 'active', completed_at: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('team_id', teamId)

  if (error) throw new Error(`Failed to reopen period: ${error.message}`)

  revalidatePath(`/periods/${id}`)
  revalidatePath('/periods')
  revalidatePath('/')
}

export async function deleteBudgetPeriod(id: string) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { error } = await supabase
    .from('budget_periods')
    .delete()
    .eq('id', id)
    .eq('team_id', teamId)

  if (error) throw new Error(`Failed to delete budget period: ${error.message}`)

  revalidatePath('/periods')
}

export async function getPeriodDetail(periodId: string) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  // Everything the budget page needs, fetched in parallel (was ~15 sequential round trips)
  const [
    periodRes,
    sessionsRes,
    expensesRes,
    linkedRes,
    manualRes,
    linkableRes,
    settingsRes,
    adjustmentsRes,
    accountsRes,
    accountTransfersRes,
    savingsGoalsRes,
    savingsAllocationsRes,
    otherPeriodsRes,
    expenseTransfersRes,
  ] = await Promise.all([
    supabase.from('budget_periods').select('*').eq('id', periodId).eq('team_id', teamId).single(),
    // Budgeting sessions (tabs), oldest first
    supabase.from('budget_sessions').select('*').eq('period_id', periodId).eq('team_id', teamId).order('seq', { ascending: true }),
    supabase.from('period_expenses').select('*').eq('period_id', periodId).eq('team_id', teamId).order('sort_order', { ascending: true }),
    supabase.from('period_linked_invoices').select('*, invoices(*)').eq('period_id', periodId),
    supabase.from('period_manual_income').select('*').eq('period_id', periodId).eq('team_id', teamId).order('created_at', { ascending: true }),
    // Any logged income is linkable — projected/sent rows get promoted to received on link.
    supabase.from('invoices').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
    supabase.from('settings').select('*').eq('team_id', teamId).limit(1).single(),
    // Income adjustments ledger (fees, pre-budget cash spends, etc.)
    supabase.from('period_adjustments').select('*').eq('period_id', periodId).eq('team_id', teamId)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    // Accounts for the one-time expense add form
    supabase.from('accounts').select('*').eq('team_id', teamId).order('sort_order', { ascending: true }),
    // Which account transfers / cash withdrawals each session has marked done
    supabase.from('period_account_transfers').select('session_id, account_name, transferred, cash_done')
      .eq('period_id', periodId).eq('team_id', teamId),
    // Active (non-achieved) savings goals
    supabase.from('savings_goals').select('*').eq('team_id', teamId).eq('is_achieved', false)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('period_savings_allocations').select('*').eq('period_id', periodId).eq('team_id', teamId),
    // Most recent other period — its allocations are the ghost values
    supabase.from('budget_periods').select('id').eq('team_id', teamId).neq('id', periodId)
      .order('created_at', { ascending: false }).limit(1),
    // Fund transfers between expense lines (zero-sum reallocations) — for history + undo
    supabase.from('period_expense_transfers').select('*').eq('period_id', periodId).eq('team_id', teamId)
      .order('created_at', { ascending: false }),
  ])

  if (periodRes.error) throw new Error(`Failed to fetch period: ${periodRes.error.message}`)
  if (sessionsRes.error) throw new Error(`Failed to fetch sessions: ${sessionsRes.error.message}`)
  if (expensesRes.error) throw new Error(`Failed to fetch period expenses: ${expensesRes.error.message}`)
  if (linkedRes.error) throw new Error(`Failed to fetch linked invoices: ${linkedRes.error.message}`)
  if (manualRes.error) throw new Error(`Failed to fetch manual income: ${manualRes.error.message}`)
  if (settingsRes.error) throw new Error(`Failed to fetch settings: ${settingsRes.error.message}`)

  const expenses = expensesRes.data ?? []
  const expenseIds = expenses.map((e) => e.id)
  const lastPeriodId = otherPeriodsRes.data?.[0]?.id as string | undefined

  // Second wave: rows keyed off the first wave's results
  const [paymentsRes, spendsRes, lastAllocsRes] = await Promise.all([
    expenseIds.length
      ? supabase.from('period_expense_payments').select('*').in('period_expense_id', expenseIds).order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    expenseIds.length
      ? supabase.from('period_expense_adjustments').select('*').in('period_expense_id', expenseIds).order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    lastPeriodId
      ? supabase.from('period_savings_allocations').select('*').eq('period_id', lastPeriodId).eq('team_id', teamId)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (paymentsRes.error) throw new Error(`Failed to fetch expense payments: ${paymentsRes.error.message}`)
  if (spendsRes.error) throw new Error(`Failed to fetch expense spends: ${spendsRes.error.message}`)

  // Sub-payments for split expenses — attach to each expense; spend-ledger entries attach
  // whole-line ones to the expense, installment ones to the payment.
  const paymentsByExpense: Record<string, Record<string, unknown>[]> = {}
  const adjustmentsByExpense: Record<string, unknown[]> = {}
  const adjustmentsByPayment: Record<string, unknown[]> = {}
  for (const p of paymentsRes.data ?? []) {
    ;(paymentsByExpense[p.period_expense_id] ??= []).push(p)
  }
  for (const a of spendsRes.data ?? []) {
    ;(adjustmentsByExpense[a.period_expense_id] ??= []).push(a)
    if (a.period_expense_payment_id) (adjustmentsByPayment[a.period_expense_payment_id] ??= []).push(a)
  }
  for (const list of Object.values(paymentsByExpense)) {
    for (const p of list) p.adjustments = adjustmentsByPayment[p.id as string] ?? []
  }
  const expensesWithPayments = expenses.map((e) => ({
    ...e,
    payments: paymentsByExpense[e.id] ?? [],
    adjustments: adjustmentsByExpense[e.id] ?? [],
  }))

  return {
    period: periodRes.data,
    sessions: sessionsRes.data ?? [],
    expenses: expensesWithPayments,
    linkedInvoices: linkedRes.data ?? [],
    manualIncome: manualRes.data ?? [],
    linkableInvoices: linkableRes.data ?? [],
    settings: settingsRes.data,
    accounts: accountsRes.data ?? [],
    adjustments: adjustmentsRes.data ?? [],
    expenseTransfers: expenseTransfersRes.data ?? [],
    savingsGoals: savingsGoalsRes.data ?? [],
    savingsAllocations: savingsAllocationsRes.data ?? [],
    lastPeriodAllocations: lastAllocsRes.data ?? [],
    accountTransfers: accountTransfersRes.data ?? [],
  }
}
