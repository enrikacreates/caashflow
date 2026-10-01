'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserTeamId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'

export async function upsertSavingsAllocation(
  periodId: string,
  savingsGoalId: string,
  amount: number
) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { error } = await supabase
    .from('period_savings_allocations')
    .upsert(
      {
        period_id: periodId,
        team_id: teamId,
        savings_goal_id: savingsGoalId,
        amount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'period_id,savings_goal_id' }
    )

  if (error) throw new Error(`Failed to upsert savings allocation: ${error.message}`)

  revalidatePath(`/periods/${periodId}`)
}

export async function applySavingsAllocations(
  periodId: string
): Promise<{ applied: Array<{ goalId: string; delta: number; isNowAchieved: boolean }> }> {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  // Fetch all allocations for this period
  const { data: allocations, error: fetchError } = await supabase
    .from('period_savings_allocations')
    .select('*')
    .eq('period_id', periodId)
    .eq('team_id', teamId)

  if (fetchError) throw new Error(`Failed to fetch allocations: ${fetchError.message}`)
  if (!allocations || allocations.length === 0) return { applied: [] }

  const applied: Array<{ goalId: string; delta: number; isNowAchieved: boolean }> = []

  for (const alloc of allocations) {
    const delta = alloc.amount - alloc.contributed
    if (delta === 0) continue

    // Fetch goal's current balance
    const { data: goal, error: goalError } = await supabase
      .from('savings_goals')
      .select('current_amount, target_amount')
      .eq('id', alloc.savings_goal_id)
      .eq('team_id', teamId)
      .single()

    if (goalError || !goal) continue // goal may have been deleted

    const newAmount = Math.max(0, goal.current_amount + delta)
    const isNowAchieved = newAmount >= goal.target_amount && goal.current_amount < goal.target_amount

    // Update goal balance
    const { error: updateGoalError } = await supabase
      .from('savings_goals')
      .update({ current_amount: newAmount, updated_at: new Date().toISOString() })
      .eq('id', alloc.savings_goal_id)
      .eq('team_id', teamId)

    if (updateGoalError) continue

    // Update contributed to match amount (delta is now applied)
    const { error: updateAllocError } = await supabase
      .from('period_savings_allocations')
      .update({ contributed: alloc.amount, updated_at: new Date().toISOString() })
      .eq('id', alloc.id)

    if (updateAllocError) continue

    applied.push({ goalId: alloc.savings_goal_id, delta, isNowAchieved })
  }

  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/savings')
  return { applied }
}

export async function removeSavingsAllocation(allocationId: string, periodId: string) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { error } = await supabase
    .from('period_savings_allocations')
    .delete()
    .eq('id', allocationId)
    .eq('team_id', teamId)

  if (error) throw new Error(`Failed to remove savings allocation: ${error.message}`)

  revalidatePath(`/periods/${periodId}`)
}
