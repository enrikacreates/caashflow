'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserHouseholdId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'

// ── Period CRUD ─────────────────────────────────────────────────────────────
// Period-level operations only. For expense/income/invoice actions within a
// period, see period-expenses.ts. For data export/import, see household.ts.

export async function getBudgetPeriods() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data, error } = await supabase
    .from('budget_periods')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch budget periods: ${error.message}`)
  return data
}

export async function createBudgetPeriod(formData: FormData) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const periodName = formData.get('period_name') as string
  const periodMonthRaw = formData.get('period_month') as string | null
  // period_month arrives as "YYYY-MM" from <input type="month"> — store as first-of-month date
  const periodMonth = periodMonthRaw ? `${periodMonthRaw}-01` : null

  const { data: period, error: periodError } = await supabase
    .from('budget_periods')
    .insert({
      household_id: householdId,
      period_name: periodName,
      period_month: periodMonth,
      income_amount: 0,
      deduction_overrides: {},
    })
    .select()
    .single()

  if (periodError) throw new Error(`Failed to create budget period: ${periodError.message}`)

  // Copy base budget items into the new period as expenses
  const { data: baseItems, error: baseError } = await supabase
    .from('base_budget_items')
    .select('*')
    .eq('household_id', householdId)
    .order('sort_order', { ascending: true })

  if (baseError) throw new Error(`Failed to fetch base budget items: ${baseError.message}`)

  if (baseItems && baseItems.length > 0) {
    const periodExpenses = baseItems.map((item, index) => ({
      period_id: period.id,
      household_id: householdId,
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

export async function completePeriod(id: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('budget_periods')
    .update({ status: 'complete', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to complete period: ${error.message}`)

  revalidatePath(`/periods/${id}`)
  revalidatePath('/periods')
  revalidatePath('/')
}

export async function reopenPeriod(id: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('budget_periods')
    .update({ status: 'active', completed_at: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to reopen period: ${error.message}`)

  revalidatePath(`/periods/${id}`)
  revalidatePath('/periods')
  revalidatePath('/')
}

export async function deleteBudgetPeriod(id: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('budget_periods')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to delete budget period: ${error.message}`)

  revalidatePath('/periods')
}

export async function getPeriodDetail(periodId: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data: period, error: periodError } = await supabase
    .from('budget_periods')
    .select('*')
    .eq('id', periodId)
    .eq('household_id', householdId)
    .single()

  if (periodError) throw new Error(`Failed to fetch period: ${periodError.message}`)

  const { data: expenses, error: expensesError } = await supabase
    .from('period_expenses')
    .select('*')
    .eq('period_id', periodId)
    .eq('household_id', householdId)
    .order('sort_order', { ascending: true })

  if (expensesError) throw new Error(`Failed to fetch period expenses: ${expensesError.message}`)

  // Sub-payments for split expenses — attach to each expense
  const expenseIds = (expenses ?? []).map((e) => e.id)
  const paymentsByExpense: Record<string, unknown[]> = {}
  if (expenseIds.length > 0) {
    const { data: payments, error: paymentsError } = await supabase
      .from('period_expense_payments')
      .select('*')
      .in('period_expense_id', expenseIds)
      .order('sort_order', { ascending: true })

    if (paymentsError) throw new Error(`Failed to fetch expense payments: ${paymentsError.message}`)

    for (const p of payments ?? []) {
      ;(paymentsByExpense[p.period_expense_id] ??= []).push(p)
    }
  }
  const expensesWithPayments = (expenses ?? []).map((e) => ({
    ...e,
    payments: paymentsByExpense[e.id] ?? [],
  }))

  const { data: linkedInvoices, error: linkedError } = await supabase
    .from('period_linked_invoices')
    .select('*, invoices(*)')
    .eq('period_id', periodId)

  if (linkedError) throw new Error(`Failed to fetch linked invoices: ${linkedError.message}`)

  const { data: manualIncome, error: incomeError } = await supabase
    .from('period_manual_income')
    .select('*')
    .eq('period_id', periodId)
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })

  if (incomeError) throw new Error(`Failed to fetch manual income: ${incomeError.message}`)

  const { data: allReceivedInvoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('household_id', householdId)
    .eq('status', 'received')
    .order('actual_received_date', { ascending: false })

  const { data: settings, error: settingsError } = await supabase
    .from('settings')
    .select('*')
    .eq('household_id', householdId)
    .limit(1)
    .single()

  if (settingsError) throw new Error(`Failed to fetch settings: ${settingsError.message}`)

  // Deduction contributions logged as income was settled (the ledger)
  const { data: deductionContributions } = await supabase
    .from('period_deduction_contributions')
    .select('*')
    .eq('period_id', periodId)
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })

  // Income adjustments ledger (fees, pre-budget cash spends, etc.)
  const { data: adjustments } = await supabase
    .from('period_adjustments')
    .select('*')
    .eq('period_id', periodId)
    .eq('household_id', householdId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  // Accounts for the one-time expense add form
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('household_id', householdId)
    .order('sort_order', { ascending: true })

  // Fetch active (non-achieved) savings goals
  const { data: savingsGoals } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_achieved', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  // Fetch this period's savings allocations
  const { data: savingsAllocations } = await supabase
    .from('period_savings_allocations')
    .select('*')
    .eq('period_id', periodId)
    .eq('household_id', householdId)

  // Fetch last period's allocations for ghost values
  let lastPeriodAllocations: typeof savingsAllocations = []
  const { data: otherPeriods } = await supabase
    .from('budget_periods')
    .select('id')
    .eq('household_id', householdId)
    .neq('id', periodId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (otherPeriods && otherPeriods.length > 0) {
    const { data: lastAllocs } = await supabase
      .from('period_savings_allocations')
      .select('*')
      .eq('period_id', otherPeriods[0].id)
      .eq('household_id', householdId)

    lastPeriodAllocations = lastAllocs || []
  }

  return {
    period,
    expenses: expensesWithPayments,
    linkedInvoices: linkedInvoices || [],
    manualIncome: manualIncome || [],
    allReceivedInvoices: allReceivedInvoices || [],
    settings,
    accounts: accounts || [],
    deductionContributions: deductionContributions || [],
    adjustments: adjustments || [],
    savingsGoals: savingsGoals || [],
    savingsAllocations: savingsAllocations || [],
    lastPeriodAllocations: lastPeriodAllocations || [],
  }
}
