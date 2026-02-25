'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserHouseholdId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'

export async function getBudgetRequests() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data, error } = await supabase
    .from('budget_requests')
    .select('*')
    .eq('household_id', householdId)
    .order('priority_category', { ascending: true })

  if (error) throw new Error(`Failed to fetch budget requests: ${error.message}`)
  return data
}

export async function createBudgetRequest(formData: FormData) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const request = {
    household_id: householdId,
    name: formData.get('name') as string,
    amount: parseFloat(formData.get('amount') as string) || 0,
    priority_category: formData.get('priority_category') as string,
    status: formData.get('status') as string || 'requested',
    tags: (formData.get('tags') as string || '').split(',').map(t => t.trim()).filter(Boolean),
    notes: formData.get('notes') as string || null,
  }

  const { error } = await supabase
    .from('budget_requests')
    .insert(request)

  if (error) throw new Error(`Failed to create budget request: ${error.message}`)

  revalidatePath('/requests')
}

export async function updateBudgetRequest(formData: FormData) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()
  const id = formData.get('id') as string

  const updates = {
    name: formData.get('name') as string,
    amount: parseFloat(formData.get('amount') as string) || 0,
    priority_category: formData.get('priority_category') as string,
    status: formData.get('status') as string || 'requested',
    tags: (formData.get('tags') as string || '').split(',').map(t => t.trim()).filter(Boolean),
    notes: formData.get('notes') as string || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('budget_requests')
    .update(updates)
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update budget request: ${error.message}`)

  revalidatePath('/requests')
}

export async function deleteBudgetRequest(id: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('budget_requests')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to delete budget request: ${error.message}`)

  revalidatePath('/requests')
}
