'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserHouseholdId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// Cloudflare R2 (S3-compatible) — stores request images
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
})

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

/** Rename (or clear, if `to` is empty) a "who/what" value across every request that uses it. */
export async function renameRequestedFor(from: string, to: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()
  const t = to.trim()
  const { error } = await supabase
    .from('budget_requests')
    .update({ requested_for: t || null, updated_at: new Date().toISOString() })
    .eq('household_id', householdId)
    .eq('requested_for', from)
  if (error) throw new Error(`Failed to rename: ${error.message}`)
  revalidatePath('/requests')
}

/** Rename (or remove, if `to` is empty) a tag across every request that has it. */
export async function renameRequestTag(from: string, to: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()
  const t = to.trim()
  const { data } = await supabase
    .from('budget_requests')
    .select('id, tags')
    .eq('household_id', householdId)
    .contains('tags', [from])
  for (const r of data ?? []) {
    const cur = (r.tags as string[]) ?? []
    const next = t
      ? [...new Set(cur.map((x) => (x === from ? t : x)))]
      : cur.filter((x) => x !== from)
    await supabase
      .from('budget_requests')
      .update({ tags: next, updated_at: new Date().toISOString() })
      .eq('id', r.id)
      .eq('household_id', householdId)
  }
  revalidatePath('/requests')
}

/** Fast brain-dump: create a request from a parsed quick-add line (defaults P7 / requested). */
export async function quickAddRequest(name: string, requestedFor: string | null = null, amount = 0) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()
  const trimmed = name.trim()
  if (!trimmed) return
  const { error } = await supabase.from('budget_requests').insert({
    household_id: householdId,
    name: trimmed.slice(0, 200),
    amount: amount || 0,
    requested_for: requestedFor?.trim() || null,
    priority_category: 'P7: UpNext',
    status: 'requested',
  })
  if (error) throw new Error(`Failed to add request: ${error.message}`)
  revalidatePath('/requests')
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
    url: (formData.get('url') as string)?.trim() || null,
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
    url: (formData.get('url') as string)?.trim() || null,
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

/** Upload a request image (file picker or camera) to Cloudflare R2; returns the public URL. */
export async function uploadRequestImage(formData: FormData): Promise<string> {
  const householdId = await getUserHouseholdId()

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) throw new Error('No file provided')

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const key = `${householdId}/${crypto.randomUUID()}.${ext}`

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type || undefined,
    })
  )

  return `${process.env.R2_PUBLIC_URL}/${key}`
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
    .select('name, amount, priority_category, url')
    .eq('id', requestId).eq('household_id', householdId).single()
  if (!req) throw new Error('Request not found')

  const { error } = await supabase.from('period_expenses').insert({
    period_id: periodId,
    household_id: householdId,
    base_item_id: null,
    name: req.name,
    default_amount: Number(req.amount) || 0,
    priority_category: req.priority_category,
    pay_url: req.url ?? null,
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

/* ─── Public (no-login) family request submission ───────────────────── */

/** Resolve a family slug → public-safe { id, name } (or null). */
export async function getPublicHousehold(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_public_household', { p_slug: slug })
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as { id: string; name: string } | null
}

/** Public submit — routes through a locked-down definer fn that only inserts a request. */
export async function submitPublicRequest(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_public_request', {
    p_slug: formData.get('slug') as string,
    p_name: formData.get('name') as string,
    p_amount: parseFloat(formData.get('amount') as string) || 0,
    p_requested_for: ((formData.get('requested_for') as string) || '').trim() || null,
    p_image_url: ((formData.get('image_url') as string) || '').trim() || null,
    p_notes: ((formData.get('notes') as string) || '').trim() || null,
    p_url: ((formData.get('url') as string) || '').trim() || null,
  })
  if (error) throw new Error(error.message)
}

/** Anonymous image upload for the public form (no household scoping). */
export async function uploadPublicRequestImage(formData: FormData): Promise<string> {
  const supabase = await createClient()
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) throw new Error('No file provided')
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `public/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('request-images')
    .upload(path, file, { upsert: true, contentType: file.type || undefined })
  if (error) throw new Error(`Image upload failed: ${error.message}`)
  return supabase.storage.from('request-images').getPublicUrl(path).data.publicUrl
}

/** Settings: set the family name + derive a unique shareable slug. */
export async function setFamilyName(formData: FormData) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()
  const name = ((formData.get('name') as string) || '').trim() || 'My Family'
  let slug =
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'family'

  const { data: clash } = await supabase
    .from('households').select('id').eq('slug', slug).neq('id', householdId).maybeSingle()
  if (clash) slug = `${slug}-${householdId.slice(0, 4)}`

  const { error } = await supabase
    .from('households')
    .update({ name, slug, updated_at: new Date().toISOString() })
    .eq('id', householdId)
  if (error) throw new Error(`Failed to set family name: ${error.message}`)

  revalidatePath('/settings')
  revalidatePath('/requests')
}

/** Settings: current family name + share slug. */
export async function getFamilyShareInfo() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()
  const { data } = await supabase
    .from('households').select('name, slug').eq('id', householdId).maybeSingle()
  return (data ?? null) as { name: string; slug: string | null } | null
}
