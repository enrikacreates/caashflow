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

  const { data: period, error: periodError } = await supabase
    .from('budget_periods')
    .insert({
      household_id: householdId,
      period_name: periodName,
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
      pay_now: false,
      transferred: false,
      paid: false,
      cleared: false,
      amount_override: null,
      override_notes: null,
      is_partial: false,
      sort_order: item.sort_order ?? index,
    }))

    const { error: expensesError } = await supabase
      .from('period_expenses')
      .insert(periodExpenses)

    if (expensesError) throw new Error(`Failed to create period expenses: ${expensesError.message}`)
  }

  revalidatePath('/periods')
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

  return {
    period,
    expenses: expenses || [],
    linkedInvoices: linkedInvoices || [],
    manualIncome: manualIncome || [],
    allReceivedInvoices: allReceivedInvoices || [],
    settings,
  }
}
