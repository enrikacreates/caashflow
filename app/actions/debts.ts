'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserHouseholdId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'

export async function getDebts() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('household_id', householdId)
    .order('is_paid_off', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch debts: ${error.message}`)
  return data ?? []
}

export async function createDebt(data: {
  name: string
  original_balance: number
  current_balance: number
  interest_rate: number | null
  minimum_payment: number | null
  due_day: number | null
  notes: string | null
}) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data: created, error } = await supabase
    .from('debts')
    .insert({ ...data, household_id: householdId })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create debt: ${error.message}`)
  revalidatePath('/debts')
  return { id: created.id as string }
}

export async function updateDebt(
  id: string,
  data: Partial<{
    name: string
    original_balance: number
    current_balance: number
    interest_rate: number | null
    minimum_payment: number | null
    due_day: number | null
    notes: string | null
  }>
) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('debts')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update debt: ${error.message}`)
  revalidatePath('/debts')
}

export async function logPayment(id: string, amount: number) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data: debt, error: fetchError } = await supabase
    .from('debts')
    .select('current_balance, minimum_payment')
    .eq('id', id)
    .eq('household_id', householdId)
    .single()

  if (fetchError || !debt) throw new Error('Debt not found')

  const newBalance = Math.max(0, debt.current_balance - amount)
  const exceedsMinimum =
    debt.minimum_payment !== null && amount > debt.minimum_payment

  const { error } = await supabase
    .from('debts')
    .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to log payment: ${error.message}`)
  revalidatePath('/debts')
  return { newBalance, exceedsMinimum }
}

export async function markPaidOff(id: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('debts')
    .update({
      is_paid_off: true,
      current_balance: 0,
      paid_off_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to mark debt as paid off: ${error.message}`)
  revalidatePath('/debts')
}

export async function deleteDebt(id: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('debts')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to delete debt: ${error.message}`)
  revalidatePath('/debts')
}

export async function setDebtBudgetItemLink(
  debtId: string,
  budgetItemId: string | null
) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  // Clear any existing link for this debt
  const { error: clearError } = await supabase
    .from('base_budget_items')
    .update({ debt_id: null, updated_at: new Date().toISOString() })
    .eq('debt_id', debtId)
    .eq('household_id', householdId)

  if (clearError) throw new Error(`Failed to clear existing link: ${clearError.message}`)

  if (budgetItemId) {
    const { error } = await supabase
      .from('base_budget_items')
      .update({ debt_id: debtId, updated_at: new Date().toISOString() })
      .eq('id', budgetItemId)
      .eq('household_id', householdId)

    if (error) throw new Error(`Failed to link budget item: ${error.message}`)
  }

  revalidatePath('/debts')
  revalidatePath('/periods')
}
