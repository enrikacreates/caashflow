'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserHouseholdId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'

export async function getSettings() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('household_id', householdId)
    .limit(1)
    .single()

  if (error) throw new Error(`Failed to fetch settings: ${error.message}`)
  return data
}

export async function updateSettings(formData: FormData) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const expenseGoalRaw = formData.get('monthly_expense_goal') as string
  const incomeGoalRaw = formData.get('monthly_income_goal') as string

  const acct = (key: string) => (formData.get(key) as string) || null

  const updates = {
    tithe_percentage: parseFloat(formData.get('tithe_percentage') as string) || 0,
    savings_percentage: parseFloat(formData.get('savings_percentage') as string) || 0,
    tax_percentage: parseFloat(formData.get('tax_percentage') as string) || 0,
    profit_percentage: parseFloat(formData.get('profit_percentage') as string) || 0,
    fun_money_percentage: parseFloat(formData.get('fun_money_percentage') as string) || 0,
    tithe_account: acct('tithe_account'),
    savings_account: acct('savings_account'),
    tax_account: acct('tax_account'),
    profit_account: acct('profit_account'),
    fun_money_account: acct('fun_money_account'),
    monthly_expense_goal: expenseGoalRaw ? parseFloat(expenseGoalRaw) || null : null,
    monthly_income_goal: incomeGoalRaw ? parseFloat(incomeGoalRaw) || null : null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('settings')
    .update(updates)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update settings: ${error.message}`)

  revalidatePath('/settings')
  revalidatePath('/periods')
  revalidatePath('/')
}

// ── Accounts CRUD ────────────────────────────────────────────────────────────

export async function getAccounts() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('household_id', householdId)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(`Failed to fetch accounts: ${error.message}`)
  return data
}

export async function createAccount(name: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  // Get next sort_order
  const { data: existing } = await supabase
    .from('accounts')
    .select('sort_order')
    .eq('household_id', householdId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  const { error } = await supabase
    .from('accounts')
    .insert({ household_id: householdId, name, sort_order: nextOrder })

  if (error) throw new Error(`Failed to create account: ${error.message}`)

  revalidatePath('/settings')
  revalidatePath('/base-budget')
}

export async function updateAccount(id: string, name: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  // Old name → so we can propagate the rename across denormalized text columns.
  const { data: existing } = await supabase
    .from('accounts')
    .select('name')
    .eq('id', id)
    .eq('household_id', householdId)
    .single()
  const from = existing?.name ?? null

  const { error } = await supabase
    .from('accounts')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update account: ${error.message}`)

  // Account names are stored as text on expenses + settings — keep them in sync.
  if (from && from !== name) {
    const now = new Date().toISOString()
    await supabase.from('base_budget_items')
      .update({ account: name, updated_at: now })
      .eq('household_id', householdId).eq('account', from)
    await supabase.from('period_expenses')
      .update({ account: name, updated_at: now })
      .eq('household_id', householdId).eq('account', from)

    const { data: s } = await supabase.from('settings')
      .select('tithe_account, savings_account, tax_account, profit_account, fun_money_account')
      .eq('household_id', householdId).single()
    if (s) {
      const patch: Record<string, string> = {}
      for (const k of ['tithe_account', 'savings_account', 'tax_account', 'profit_account', 'fun_money_account'] as const) {
        if (s[k] === from) patch[k] = name
      }
      if (Object.keys(patch).length) {
        await supabase.from('settings')
          .update({ ...patch, updated_at: now })
          .eq('household_id', householdId)
      }
    }
  }

  revalidatePath('/settings')
  revalidatePath('/base-budget')
  revalidatePath('/periods')
  revalidatePath('/')
}

export async function deleteAccount(id: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to delete account: ${error.message}`)

  revalidatePath('/settings')
  revalidatePath('/base-budget')
}

export async function reorderAccounts(ids: string[]) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from('accounts')
      .update({ sort_order: i, updated_at: new Date().toISOString() })
      .eq('id', ids[i])
      .eq('household_id', householdId)

    if (error) throw new Error(`Failed to reorder accounts: ${error.message}`)
  }

  revalidatePath('/settings')
}

// ── Priority Categories CRUD ─────────────────────────────────────────────────

export async function getPriorityCategories() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data, error } = await supabase
    .from('priority_categories')
    .select('*')
    .eq('household_id', householdId)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(`Failed to fetch priority categories: ${error.message}`)
  return data
}

export async function createPriorityCategory(name: string, colorKey: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data: existing } = await supabase
    .from('priority_categories')
    .select('sort_order')
    .eq('household_id', householdId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  const { error } = await supabase
    .from('priority_categories')
    .insert({ household_id: householdId, name, color_key: colorKey, sort_order: nextOrder })

  if (error) throw new Error(`Failed to create priority category: ${error.message}`)

  revalidatePath('/settings')
  revalidatePath('/base-budget')
  revalidatePath('/requests')
}

export async function updatePriorityCategory(id: string, name: string, colorKey: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  // Old name → so we can propagate the rename across denormalized text columns.
  const { data: existing } = await supabase
    .from('priority_categories')
    .select('name')
    .eq('id', id)
    .eq('household_id', householdId)
    .single()
  const from = existing?.name ?? null

  const { error } = await supabase
    .from('priority_categories')
    .update({ name, color_key: colorKey, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update priority category: ${error.message}`)

  // Category names are stored as text on expenses + requests — keep them in sync.
  if (from && from !== name) {
    const now = new Date().toISOString()
    await supabase.from('base_budget_items')
      .update({ priority_category: name, updated_at: now })
      .eq('household_id', householdId).eq('priority_category', from)
    await supabase.from('period_expenses')
      .update({ priority_category: name, updated_at: now })
      .eq('household_id', householdId).eq('priority_category', from)
    await supabase.from('budget_requests')
      .update({ priority_category: name, updated_at: now })
      .eq('household_id', householdId).eq('priority_category', from)
  }

  revalidatePath('/settings')
  revalidatePath('/base-budget')
  revalidatePath('/requests')
  revalidatePath('/periods')
}

export async function deletePriorityCategory(id: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('priority_categories')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to delete priority category: ${error.message}`)

  revalidatePath('/settings')
  revalidatePath('/base-budget')
  revalidatePath('/requests')
}

export async function reorderPriorityCategories(ids: string[]) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from('priority_categories')
      .update({ sort_order: i, updated_at: new Date().toISOString() })
      .eq('id', ids[i])
      .eq('household_id', householdId)

    if (error) throw new Error(`Failed to reorder priority categories: ${error.message}`)
  }

  revalidatePath('/settings')
}
