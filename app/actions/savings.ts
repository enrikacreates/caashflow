'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserHouseholdId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'

export async function getSavingsGoals() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('household_id', householdId)
    .order('is_achieved', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch savings goals: ${error.message}`)
  return data ?? []
}

export async function createSavingsGoal(data: {
  name: string
  goal_type: 'purchase' | 'fund'
  target_amount: number
  current_amount: number
  monthly_contribution: number | null
  target_date: string | null
  notes: string | null
}) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data: created, error } = await supabase
    .from('savings_goals')
    .insert({ ...data, household_id: householdId })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create savings goal: ${error.message}`)
  revalidatePath('/savings')
  return { id: created.id as string }
}

export async function updateSavingsGoal(
  id: string,
  data: Partial<{
    name: string
    goal_type: 'purchase' | 'fund'
    target_amount: number
    current_amount: number
    monthly_contribution: number | null
    target_date: string | null
    notes: string | null
  }>
) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('savings_goals')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update savings goal: ${error.message}`)
  revalidatePath('/savings')
}

/** All adjustment-ledger entries for the household's goals (newest first). */
export async function getSavingsAdjustments() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data, error } = await supabase
    .from('savings_goal_adjustments')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch savings adjustments: ${error.message}`)
  return data ?? []
}

/** Adjust a goal's balance by a signed amount with an optional note; logs a ledger entry. */
export async function addSavingsAdjustment(id: string, amount: number, note: string | null) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data: goal, error: fetchError } = await supabase
    .from('savings_goals')
    .select('current_amount, target_amount, monthly_contribution')
    .eq('id', id)
    .eq('household_id', householdId)
    .single()

  if (fetchError || !goal) throw new Error('Savings goal not found')

  const newAmount = goal.current_amount + amount
  const exceedsMonthly =
    goal.monthly_contribution !== null && amount > goal.monthly_contribution
  const isNowAchieved = newAmount >= goal.target_amount

  const { error: ledgerError } = await supabase
    .from('savings_goal_adjustments')
    .insert({ household_id: householdId, savings_goal_id: id, amount, note: note?.trim() || null })
  if (ledgerError) throw new Error(`Failed to log adjustment: ${ledgerError.message}`)

  const { error } = await supabase
    .from('savings_goals')
    .update({ current_amount: newAmount, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to adjust balance: ${error.message}`)
  revalidatePath('/savings')
  return { newAmount, exceedsMonthly, isNowAchieved }
}

/** Undo a ledger entry — removes it and reverses its effect on the goal balance. */
export async function removeSavingsAdjustment(adjustmentId: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data: adj, error: fetchError } = await supabase
    .from('savings_goal_adjustments')
    .select('savings_goal_id, amount')
    .eq('id', adjustmentId)
    .eq('household_id', householdId)
    .single()
  if (fetchError || !adj) throw new Error('Adjustment not found')

  const { data: goal } = await supabase
    .from('savings_goals')
    .select('current_amount')
    .eq('id', adj.savings_goal_id)
    .eq('household_id', householdId)
    .single()

  const { error: delError } = await supabase
    .from('savings_goal_adjustments')
    .delete()
    .eq('id', adjustmentId)
    .eq('household_id', householdId)
  if (delError) throw new Error(`Failed to remove adjustment: ${delError.message}`)

  if (goal) {
    await supabase
      .from('savings_goals')
      .update({ current_amount: goal.current_amount - adj.amount, updated_at: new Date().toISOString() })
      .eq('id', adj.savings_goal_id)
      .eq('household_id', householdId)
  }

  revalidatePath('/savings')
}

export async function markAchieved(id: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('savings_goals')
    .update({
      is_achieved: true,
      achieved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to mark goal as achieved: ${error.message}`)
  revalidatePath('/savings')
}

export async function deleteSavingsGoal(id: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('savings_goals')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to delete savings goal: ${error.message}`)
  revalidatePath('/savings')
}

export async function setSavingsGoalBudgetItemLink(
  goalId: string,
  budgetItemId: string | null
) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  // Clear any existing link for this goal
  const { error: clearError } = await supabase
    .from('base_budget_items')
    .update({ savings_goal_id: null, updated_at: new Date().toISOString() })
    .eq('savings_goal_id', goalId)
    .eq('household_id', householdId)

  if (clearError) throw new Error(`Failed to clear existing link: ${clearError.message}`)

  if (budgetItemId) {
    const { error } = await supabase
      .from('base_budget_items')
      .update({ savings_goal_id: goalId, updated_at: new Date().toISOString() })
      .eq('id', budgetItemId)
      .eq('household_id', householdId)

    if (error) throw new Error(`Failed to link budget item: ${error.message}`)
  }

  revalidatePath('/savings')
  revalidatePath('/periods')
}
