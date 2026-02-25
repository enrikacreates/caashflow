'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserHouseholdId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'
import { DEFAULT_BASE_BUDGET } from '@/lib/constants'

export async function getBaseBudgetItems() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data, error } = await supabase
    .from('base_budget_items')
    .select('*')
    .eq('household_id', householdId)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(`Failed to fetch base budget items: ${error.message}`)
  return data
}

export async function createBaseBudgetItem(formData: FormData) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const item = {
    household_id: householdId,
    name: formData.get('name') as string,
    default_amount: parseFloat(formData.get('default_amount') as string) || 0,
    due_day: formData.get('due_day') ? parseInt(formData.get('due_day') as string, 10) : null,
    account: formData.get('account') as string || null,
    priority_category: formData.get('priority_category') as string || null,
    frequency: formData.get('frequency') as string || 'Monthly',
    auto_pay: formData.get('auto_pay') === 'on',
    pay_url: formData.get('pay_url') as string || null,
    notes: formData.get('notes') as string || null,
    tags: (formData.get('tags') as string || '').split(',').map(t => t.trim()).filter(Boolean),
  }

  const { error } = await supabase
    .from('base_budget_items')
    .insert(item)

  if (error) throw new Error(`Failed to create base budget item: ${error.message}`)

  revalidatePath('/base-budget')
}

export async function updateBaseBudgetItem(formData: FormData) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()
  const id = formData.get('id') as string

  const updates = {
    name: formData.get('name') as string,
    default_amount: parseFloat(formData.get('default_amount') as string) || 0,
    due_day: formData.get('due_day') ? parseInt(formData.get('due_day') as string, 10) : null,
    account: formData.get('account') as string || null,
    priority_category: formData.get('priority_category') as string || null,
    frequency: formData.get('frequency') as string || 'Monthly',
    auto_pay: formData.get('auto_pay') === 'on',
    pay_url: formData.get('pay_url') as string || null,
    notes: formData.get('notes') as string || null,
    tags: (formData.get('tags') as string || '').split(',').map(t => t.trim()).filter(Boolean),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('base_budget_items')
    .update(updates)
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update base budget item: ${error.message}`)

  revalidatePath('/base-budget')
}

export async function deleteBaseBudgetItem(id: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('base_budget_items')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to delete base budget item: ${error.message}`)

  revalidatePath('/base-budget')
}

export async function resetBaseBudgetToDefaults() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  // Delete all existing items for this household
  const { error: deleteError } = await supabase
    .from('base_budget_items')
    .delete()
    .eq('household_id', householdId)

  if (deleteError) throw new Error(`Failed to clear base budget: ${deleteError.message}`)

  // Insert all default items
  const items = DEFAULT_BASE_BUDGET.map((item, index) => ({
    household_id: householdId,
    name: item.name,
    default_amount: item.default_amount,
    due_day: item.due_day ?? null,
    account: item.account || null,
    priority_category: item.priority_category || null,
    frequency: item.frequency,
    auto_pay: item.auto_pay,
    pay_url: null,
    notes: item.notes ?? null,
    tags: item.tags || [],
    sort_order: index,
  }))

  const { error: insertError } = await supabase
    .from('base_budget_items')
    .insert(items)

  if (insertError) throw new Error(`Failed to insert default base budget: ${insertError.message}`)

  revalidatePath('/base-budget')
}
