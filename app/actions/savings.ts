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

export async function addContribution(id: string, amount: number) {
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

  const { error } = await supabase
    .from('savings_goals')
    .update({
      current_amount: newAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to add contribution: ${error.message}`)
  revalidatePath('/savings')
  return { newAmount, exceedsMonthly, isNowAchieved }
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
