'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserTeamId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'
import { DEFAULT_BASE_BUDGET } from '@/lib/constants'
import { budgetLineFor } from '@/lib/annual'

export async function getBaseBudgetItems() {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { data, error } = await supabase
    .from('base_budget_items')
    .select('*')
    .eq('team_id', teamId)
    .is('archived_at', null)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(`Failed to fetch base budget items: ${error.message}`)
  return data
}

function formInt(formData: FormData, key: string): number | null {
  const n = parseInt(formData.get(key) as string, 10)
  return Number.isNaN(n) ? null : n
}

export async function createBaseBudgetItem(formData: FormData) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const item = {
    team_id: teamId,
    name: formData.get('name') as string,
    default_amount: parseFloat(formData.get('default_amount') as string) || 0,
    due_day: formData.get('due_day') ? parseInt(formData.get('due_day') as string, 10) : null,
    account: formData.get('account') as string || null,
    priority_category: formData.get('priority_category') as string || null,
    frequency: formData.get('frequency') as string || 'Monthly',
    auto_pay: formData.get('auto_pay') === 'on',
    track_spending: formData.get('track_spending') === 'on',
    pay_url: formData.get('pay_url') as string || null,
    notes: formData.get('notes') as string || null,
    tags: (formData.get('tags') as string || '').split(',').map(t => t.trim()).filter(Boolean),
    due_month: formInt(formData, 'due_month'),
    remind_months: formInt(formData, 'remind_months'),
    split_months: formInt(formData, 'split_months'),
  }

  const { error } = await supabase
    .from('base_budget_items')
    .insert(item)

  if (error) throw new Error(`Failed to create base budget item: ${error.message}`)

  revalidatePath('/base-budget')
  revalidatePath('/')
}

export async function updateBaseBudgetItem(formData: FormData) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()
  const id = formData.get('id') as string

  const updates = {
    name: formData.get('name') as string,
    default_amount: parseFloat(formData.get('default_amount') as string) || 0,
    due_day: formData.get('due_day') ? parseInt(formData.get('due_day') as string, 10) : null,
    account: formData.get('account') as string || null,
    priority_category: formData.get('priority_category') as string || null,
    frequency: formData.get('frequency') as string || 'Monthly',
    auto_pay: formData.get('auto_pay') === 'on',
    track_spending: formData.get('track_spending') === 'on',
    pay_url: formData.get('pay_url') as string || null,
    notes: formData.get('notes') as string || null,
    tags: (formData.get('tags') as string || '').split(',').map(t => t.trim()).filter(Boolean),
    due_month: formInt(formData, 'due_month'),
    remind_months: formInt(formData, 'remind_months'),
    split_months: formInt(formData, 'split_months'),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('base_budget_items')
    .update(updates)
    .eq('id', id)
    .eq('team_id', teamId)

  if (error) throw new Error(`Failed to update base budget item: ${error.message}`)

  revalidatePath('/base-budget')
  revalidatePath('/')
}

/** Quick inline toggle of a baseline item's draw-down (track-spending) flag. */
export async function setBaseItemTrackSpending(id: string, value: boolean) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { error } = await supabase
    .from('base_budget_items')
    .update({ track_spending: value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('team_id', teamId)

  if (error) throw new Error(`Failed to update track spending: ${error.message}`)

  revalidatePath('/base-budget')
}

export async function deleteBaseBudgetItem(id: string) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { error } = await supabase
    .from('base_budget_items')
    .delete()
    .eq('id', id)
    .eq('team_id', teamId)

  if (error) throw new Error(`Failed to delete base budget item: ${error.message}`)

  revalidatePath('/base-budget')
}

export async function resetBaseBudgetToDefaults() {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  // Delete all existing items for this household
  const { error: deleteError } = await supabase
    .from('base_budget_items')
    .delete()
    .eq('team_id', teamId)

  if (deleteError) throw new Error(`Failed to clear base budget: ${deleteError.message}`)

  // Insert all default items
  const items = DEFAULT_BASE_BUDGET.map((item, index) => ({
    team_id: teamId,
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

export async function getArchivedBaseItems() {
  const supabase = await createClient()
  const teamId = await getUserTeamId()
  const { data, error } = await supabase
    .from('base_budget_items')
    .select('*')
    .eq('team_id', teamId)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })
  if (error) throw new Error(`Failed to fetch archived items: ${error.message}`)
  return data
}

function revalidateBills() {
  revalidatePath('/base-budget')
  revalidatePath('/periods', 'layout')
  revalidatePath('/')
}

/**
 * Stop paying a bill without losing its history. Past budgets keep it, and so does any
 * budget where it was already worked. Untouched lines in this month's and later budgets
 * come off, since nothing happened on them. `currentMonth` is "YYYY-MM" on the viewer's clock.
 */
export async function archiveBaseItem(id: string, currentMonth: string) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { error } = await supabase
    .from('base_budget_items')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id).eq('team_id', teamId)
  if (error) throw new Error(`Failed to archive: ${error.message}`)

  const { data: periods } = await supabase
    .from('budget_periods')
    .select('id')
    .eq('team_id', teamId).eq('kind', 'monthly').gte('period_month', `${currentMonth}-01`)
  const periodIds = (periods ?? []).map((p) => p.id)
  if (periodIds.length) {
    const { data: lines } = await supabase
      .from('period_expenses')
      .select('id, period_expense_adjustments(id), period_expense_payments(id)')
      .eq('team_id', teamId).eq('base_item_id', id).in('period_id', periodIds)
      .eq('pay_now', false).eq('paid', false).eq('cleared', false).eq('is_complete', false)
      .eq('paid_outside', false).eq('paid_amount', 0)
    const untouched = (lines ?? [])
      .filter((l) => !l.period_expense_adjustments?.length && !l.period_expense_payments?.length)
      .map((l) => l.id)
    if (untouched.length) {
      await supabase.from('period_expenses').delete().eq('team_id', teamId).in('id', untouched)
    }
  }
  revalidateBills()
}

/** Bring an archived bill back, including into this month's budget if it's missing there. */
export async function restoreBaseItem(id: string, currentMonth: string) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { data: item, error } = await supabase
    .from('base_budget_items')
    .update({ archived_at: null })
    .eq('id', id).eq('team_id', teamId)
    .select('*').single()
  if (error || !item) throw new Error('Failed to restore that bill')

  const { data: periods } = await supabase
    .from('budget_periods')
    .select('id, status')
    .eq('team_id', teamId).eq('kind', 'monthly').eq('period_month', `${currentMonth}-01`)
    .order('created_at', { ascending: false })
  const period = (periods ?? []).find((p) => p.status !== 'complete')
  const line = budgetLineFor(item, Number(currentMonth.slice(5, 7)) - 1)
  if (period && line) {
    const { count } = await supabase
      .from('period_expenses')
      .select('id', { count: 'exact', head: true })
      .eq('period_id', period.id).eq('base_item_id', id)
    if (!count) {
      await supabase.from('period_expenses').insert({
        period_id: period.id,
        team_id: teamId,
        base_item_id: id,
        name: item.name,
        default_amount: line.amount,
        annual_part: line.part,
        annual_parts: line.parts,
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
        track_spending: item.track_spending ?? false,
        sort_order: item.sort_order ?? 0,
      })
    }
  }
  revalidateBills()
}
