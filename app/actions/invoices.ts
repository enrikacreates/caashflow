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

/**
 * Add an income row to a budget period in one click — works regardless of current status.
 * Marks the income received (sets received date if missing), flags it budgeted, and links it
 * to the period (idempotent: skips the link if it already exists).
 */
export async function addIncomeToBudget(invoiceId: string, periodId: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('actual_received_date')
    .eq('id', invoiceId)
    .eq('household_id', householdId)
    .single()

  if (fetchError) throw new Error(`Failed to load income: ${fetchError.message}`)

  const today = new Date().toISOString().slice(0, 10)
  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      status: 'received',
      actual_received_date: invoice.actual_received_date ?? today,
      budgeted: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .eq('household_id', householdId)

  if (updateError) throw new Error(`Failed to mark income received: ${updateError.message}`)

  // Link to the period unless it's already linked (period_linked_invoices is RLS-scoped, no household_id)
  const { count } = await supabase
    .from('period_linked_invoices')
    .select('*', { count: 'exact', head: true })
    .eq('period_id', periodId)
    .eq('invoice_id', invoiceId)

  if ((count ?? 0) === 0) {
    const { error: linkError } = await supabase
      .from('period_linked_invoices')
      .insert({ period_id: periodId, invoice_id: invoiceId })

    if (linkError) throw new Error(`Failed to link income to budget: ${linkError.message}`)
  }

  revalidatePath('/cashflow')
  revalidatePath('/invoices')
  revalidatePath('/periods')
  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/')
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
