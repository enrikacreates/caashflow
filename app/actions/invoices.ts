'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserHouseholdId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'

export async function getInvoices() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data, error } = await supabase
    .from('invoices')
    .select('*, period_linked_invoices ( period_id, budget_periods ( id, period_name ) )')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch invoices: ${error.message}`)
  return data
}

export async function createInvoice(formData: FormData) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const invoice = {
    household_id: householdId,
    client_name: formData.get('client_name') as string,
    project_name: formData.get('project_name') as string || null,
    amount: parseFloat(formData.get('amount') as string) || 0,
    status: formData.get('status') as string || 'projected',
    projected_date: formData.get('projected_date') as string || null,
    actual_received_date: formData.get('actual_received_date') as string || null,
    month: formData.get('month') as string || null,
  }

  const { error } = await supabase
    .from('invoices')
    .insert(invoice)

  if (error) throw new Error(`Failed to create invoice: ${error.message}`)

  revalidatePath('/cashflow')
  revalidatePath('/invoices')
}

export async function updateInvoice(formData: FormData) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()
  const id = formData.get('id') as string

  const updates = {
    client_name: formData.get('client_name') as string,
    project_name: formData.get('project_name') as string || null,
    amount: parseFloat(formData.get('amount') as string) || 0,
    status: formData.get('status') as string || 'projected',
    projected_date: formData.get('projected_date') as string || null,
    actual_received_date: formData.get('actual_received_date') as string || null,
    month: formData.get('month') as string || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update invoice: ${error.message}`)

  revalidatePath('/cashflow')
  revalidatePath('/invoices')
}

export async function deleteInvoice(id: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to delete invoice: ${error.message}`)

  revalidatePath('/cashflow')
  revalidatePath('/invoices')
}
