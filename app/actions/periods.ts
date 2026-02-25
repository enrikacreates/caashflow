'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserHouseholdId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'

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

export async function updateExpenseField(
  expenseId: string,
  field: string,
  value: boolean | number | string | null
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('period_expenses')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', expenseId)

  if (error) throw new Error(`Failed to update expense: ${error.message}`)

  revalidatePath('/periods')
}

export async function linkInvoiceToPeriod(periodId: string, invoiceId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('period_linked_invoices')
    .insert({ period_id: periodId, invoice_id: invoiceId })

  if (error) throw new Error(`Failed to link invoice: ${error.message}`)

  revalidatePath('/periods')
}

export async function unlinkInvoiceFromPeriod(linkId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('period_linked_invoices')
    .delete()
    .eq('id', linkId)

  if (error) throw new Error(`Failed to unlink invoice: ${error.message}`)

  revalidatePath('/periods')
}

export async function addManualIncome(periodId: string, description: string, amount: number) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('period_manual_income')
    .insert({
      period_id: periodId,
      household_id: householdId,
      description,
      amount,
    })

  if (error) throw new Error(`Failed to add manual income: ${error.message}`)

  revalidatePath('/periods')
}

export async function deleteManualIncome(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('period_manual_income')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete manual income: ${error.message}`)

  revalidatePath('/periods')
}

export async function recalculatePeriodIncome(periodId: string) {
  const supabase = await createClient()

  const { data: linkedRows } = await supabase
    .from('period_linked_invoices')
    .select('invoices(amount)')
    .eq('period_id', periodId)

  const invoiceTotal = (linkedRows || []).reduce(
    (sum: number, row: Record<string, unknown>) => {
      const inv = row.invoices as { amount: number } | null
      return sum + (inv?.amount || 0)
    },
    0
  )

  const { data: manualRows } = await supabase
    .from('period_manual_income')
    .select('amount')
    .eq('period_id', periodId)

  const manualTotal = (manualRows || []).reduce(
    (sum: number, row: { amount: number }) => sum + row.amount,
    0
  )

  const totalIncome = invoiceTotal + manualTotal

  const { error } = await supabase
    .from('budget_periods')
    .update({ income_amount: totalIncome, updated_at: new Date().toISOString() })
    .eq('id', periodId)

  if (error) throw new Error(`Failed to recalculate income: ${error.message}`)

  revalidatePath('/periods')
}

export async function updatePeriodDeductions(
  periodId: string,
  overrides: Record<string, number | undefined>
) {
  const supabase = await createClient()

  const { data: period } = await supabase
    .from('budget_periods')
    .select('deduction_overrides')
    .eq('id', periodId)
    .single()

  const existingOverrides = (period?.deduction_overrides as Record<string, number | undefined>) || {}
  const merged = { ...existingOverrides, ...overrides }

  Object.keys(merged).forEach((key) => {
    if (merged[key] === undefined || merged[key] === null) {
      delete merged[key]
    }
  })

  const { error } = await supabase
    .from('budget_periods')
    .update({ deduction_overrides: merged, updated_at: new Date().toISOString() })
    .eq('id', periodId)

  if (error) throw new Error(`Failed to update deductions: ${error.message}`)

  revalidatePath('/periods')
}

export async function exportAllData() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const [settings, baseBudget, invoices, requests, periods] = await Promise.all([
    supabase.from('settings').select('*').eq('household_id', householdId),
    supabase.from('base_budget_items').select('*').eq('household_id', householdId),
    supabase.from('invoices').select('*').eq('household_id', householdId),
    supabase.from('budget_requests').select('*').eq('household_id', householdId),
    supabase.from('budget_periods').select('*').eq('household_id', householdId),
  ])

  return {
    exportDate: new Date().toISOString(),
    settings: settings.data,
    baseBudgetItems: baseBudget.data,
    invoices: invoices.data,
    budgetRequests: requests.data,
    budgetPeriods: periods.data,
  }
}

// Convert camelCase key to snake_case
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

// Convert an object's keys from camelCase to snake_case
function keysToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[toSnakeCase(key)] = value
  }
  return result
}

export async function importData(jsonData: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()
  const data = JSON.parse(jsonData)

  // Support both old format (baseBudget) and new format (baseBudgetItems)
  const budgetItems = data.baseBudget || data.baseBudgetItems
  if (budgetItems && Array.isArray(budgetItems) && budgetItems.length > 0) {
    await supabase.from('base_budget_items').delete().eq('household_id', householdId)
    const items = budgetItems.map((item: Record<string, unknown>, index: number) => {
      const converted = keysToSnake(item)
      // Strip fields that shouldn't be imported
      const { id: _id, household_id: _hid, created_at: _ca, updated_at: _ua, ...rest } = converted
      return {
        ...rest,
        household_id: householdId,
        sort_order: rest.sort_order ?? index,
        tags: rest.tags || [],
      }
    })
    const { error } = await supabase.from('base_budget_items').insert(items)
    if (error) throw new Error(`Failed to import budget items: ${error.message}`)
  }

  if (data.invoices && Array.isArray(data.invoices) && data.invoices.length > 0) {
    await supabase.from('invoices').delete().eq('household_id', householdId)
    const invoices = data.invoices.map((inv: Record<string, unknown>) => {
      const converted = keysToSnake(inv)
      const { id: _id, household_id: _hid, created_at: _ca, updated_at: _ua, ...rest } = converted
      return { ...rest, household_id: householdId }
    })
    const { error } = await supabase.from('invoices').insert(invoices)
    if (error) throw new Error(`Failed to import invoices: ${error.message}`)
  }

  if (data.budgetRequests && Array.isArray(data.budgetRequests) && data.budgetRequests.length > 0) {
    await supabase.from('budget_requests').delete().eq('household_id', householdId)
    const requests = data.budgetRequests.map((req: Record<string, unknown>) => {
      const converted = keysToSnake(req)
      const { id: _id, household_id: _hid, created_at: _ca, updated_at: _ua, ...rest } = converted
      return {
        ...rest,
        household_id: householdId,
        tags: rest.tags || [],
      }
    })
    const { error } = await supabase.from('budget_requests').insert(requests)
    if (error) throw new Error(`Failed to import requests: ${error.message}`)
  }

  // Import settings if present (old format)
  if (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) {
    const converted = keysToSnake(data.settings)
    const updates: Record<string, unknown> = {}
    if (converted.tithe_percentage !== undefined) updates.tithe_percentage = converted.tithe_percentage
    if (converted.savings_percentage !== undefined) updates.savings_percentage = converted.savings_percentage
    if (converted.tax_percentage !== undefined) updates.tax_percentage = converted.tax_percentage
    if (converted.profit_percentage !== undefined) updates.profit_percentage = converted.profit_percentage
    if (converted.fun_money_percentage !== undefined) updates.fun_money_percentage = converted.fun_money_percentage

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('household_id', householdId)
    }
  }

  revalidatePath('/')
  revalidatePath('/base-budget')
  revalidatePath('/cashflow')
  revalidatePath('/requests')
  revalidatePath('/settings')
}

export async function seedBaseBudgetDefaults() {
  const { resetBaseBudgetToDefaults } = await import('./base-budget')
  return resetBaseBudgetToDefaults()
}

export async function seedBudgetRequestDefaults() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()
  const { DEFAULT_REQUESTS } = await import('@/lib/constants')

  await supabase.from('budget_requests').delete().eq('household_id', householdId)

  const requests = DEFAULT_REQUESTS.map((req) => ({
    household_id: householdId,
    ...req,
  }))

  const { error } = await supabase.from('budget_requests').insert(requests)
  if (error) throw new Error(`Failed to seed requests: ${error.message}`)

  revalidatePath('/requests')
}
