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
    requested_for: (formData.get('requested_for') as string)?.trim() || null,
    image_url: (formData.get('image_url') as string)?.trim() || null,
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
    requested_for: (formData.get('requested_for') as string)?.trim() || null,
    image_url: (formData.get('image_url') as string)?.trim() || null,
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

/** Upload a request image (file picker or camera) to storage; returns the public URL. */
export async function uploadRequestImage(formData: FormData): Promise<string> {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) throw new Error('No file provided')

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${householdId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from('request-images')
    .upload(path, file, { upsert: true, contentType: file.type || undefined })
  if (error) throw new Error(`Image upload failed: ${error.message}`)

  return supabase.storage.from('request-images').getPublicUrl(path).data.publicUrl
}

/** Quick status change from the card. */
export async function setRequestStatus(id: string, status: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()
  const { error } = await supabase
    .from('budget_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id).eq('household_id', householdId)
  if (error) throw new Error(`Failed to update status: ${error.message}`)
  revalidatePath('/requests')
}

/** The household's latest active period — used to offer "Allocate to {period}". */
export async function getActivePeriodForRequests() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()
  const { data } = await supabase
    .from('budget_periods')
    .select('id, period_name')
    .eq('household_id', householdId).eq('status', 'active')
    .order('period_month', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as { id: string; period_name: string } | null
}

/** Drop a request into the active period's Extra (one-time) expenses, and mark it approved. */
export async function allocateRequestToPeriod(requestId: string, periodId: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data: req } = await supabase
    .from('budget_requests')
    .select('name, amount, priority_category')
    .eq('id', requestId).eq('household_id', householdId).single()
  if (!req) throw new Error('Request not found')

  const { error } = await supabase.from('period_expenses').insert({
    period_id: periodId,
    household_id: householdId,
    base_item_id: null,
    name: req.name,
    default_amount: Number(req.amount) || 0,
    priority_category: req.priority_category,
    frequency: 'One-Time',
    pay_now: false,
  })
  if (error) throw new Error(`Failed to allocate request: ${error.message}`)

  await supabase
    .from('budget_requests')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', requestId).eq('household_id', householdId)

  revalidatePath('/requests')
  revalidatePath(`/periods/${periodId}`)
}
