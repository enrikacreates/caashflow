'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserHouseholdId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'

export async function markExpensePaid(expenseId: string): Promise<{ exceedsMinimum: boolean }> {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  // Fetch the expense to check for a linked debt
  const { data: expense, error: fetchError } = await supabase
    .from('period_expenses')
    .select('debt_id, amount_override, default_amount, period_id')
    .eq('id', expenseId)
    .eq('household_id', householdId)
    .single()

  if (fetchError || !expense) throw new Error('Expense not found')

  // Mark as paid
  const { error: updateError } = await supabase
    .from('period_expenses')
    .update({ paid: true, updated_at: new Date().toISOString() })
    .eq('id', expenseId)
    .eq('household_id', householdId)

  if (updateError) throw new Error(`Failed to mark expense paid: ${updateError.message}`)

  let exceedsMinimum = false

  if (expense.debt_id) {
    const paymentAmount = expense.amount_override ?? expense.default_amount

    const { data: debt, error: debtFetchError } = await supabase
      .from('debts')
      .select('current_balance, minimum_payment')
      .eq('id', expense.debt_id)
      .eq('household_id', householdId)
      .single()

    if (!debtFetchError && debt) {
      const newBalance = Math.max(0, debt.current_balance - paymentAmount)
      exceedsMinimum =
        debt.minimum_payment !== null && paymentAmount > debt.minimum_payment

      await supabase
        .from('debts')
        .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', expense.debt_id)
        .eq('household_id', householdId)

      revalidatePath('/debts')
    }
  }

  revalidatePath(`/periods/${expense.period_id}`)
  revalidatePath('/periods')
  return { exceedsMinimum }
}

export async function updateExpenseField(
  expenseId: string,
  field: string,
  value: boolean | number | string | null
) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('period_expenses')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', expenseId)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update expense field: ${error.message}`)

  revalidatePath('/periods')
}

export async function updateExpenseBulk(
  expenseId: string,
  data: Record<string, unknown>
) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('period_expenses')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', expenseId)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to bulk update expense: ${error.message}`)

  revalidatePath('/periods')
}

export async function updateDeductionOverrides(
  periodId: string,
  overrides: Record<string, number | null>
) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('budget_periods')
    .update({
      deduction_overrides: overrides,
      updated_at: new Date().toISOString(),
    })
    .eq('id', periodId)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update deduction overrides: ${error.message}`)

  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/periods')
}

export async function linkInvoiceToPeriod(periodId: string, invoiceId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('period_linked_invoices')
    .insert({
      period_id: periodId,
      invoice_id: invoiceId,
    })

  if (error) throw new Error(`Failed to link invoice to period: ${error.message}`)

  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/periods')
}

export async function unlinkInvoiceFromPeriod(periodId: string, invoiceId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('period_linked_invoices')
    .delete()
    .eq('period_id', periodId)
    .eq('invoice_id', invoiceId)

  if (error) throw new Error(`Failed to unlink invoice from period: ${error.message}`)

  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/periods')
}

export async function addManualIncome(
  periodId: string,
  description: string,
  amount: number
) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('period_manual_income')
    .insert({
      period_id: periodId,
      household_id: householdId,
      description,
      amount,
    })

  if (error) throw new Error(`Failed to add manual income: ${error.message}`)

  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/periods')
}

export async function removeManualIncome(id: string) {
  const supabase = await createClient()

  // Fetch the record first to get periodId for revalidation
  const { data: record, error: fetchError } = await supabase
    .from('period_manual_income')
    .select('period_id')
    .eq('id', id)
    .single()

  if (fetchError) throw new Error(`Failed to find manual income entry: ${fetchError.message}`)

  const { error } = await supabase
    .from('period_manual_income')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to remove manual income: ${error.message}`)

  revalidatePath(`/periods/${record.period_id}`)
  revalidatePath('/periods')
}

export async function recalculatePeriodIncome(periodId: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  // Sum linked invoice amounts where status is 'received'
  const { data: linkedInvoices, error: linkedError } = await supabase
    .from('period_linked_invoices')
    .select('invoice_id, invoices(amount, status)')
    .eq('period_id', periodId)

  if (linkedError) throw new Error(`Failed to fetch linked invoices: ${linkedError.message}`)

  const invoiceTotal = (linkedInvoices || []).reduce((sum, link) => {
    const invoice = link.invoices as unknown as { amount: number; status: string }
    if (invoice && invoice.status === 'received') {
      return sum + (invoice.amount || 0)
    }
    return sum
  }, 0)

  // Sum manual income amounts
  const { data: manualIncomeRows, error: manualError } = await supabase
    .from('period_manual_income')
    .select('amount')
    .eq('period_id', periodId)
    .eq('household_id', householdId)

  if (manualError) throw new Error(`Failed to fetch manual income: ${manualError.message}`)

  const manualTotal = (manualIncomeRows || []).reduce(
    (sum, row) => sum + (row.amount || 0),
    0
  )

  // Update the period's income_amount
  const { error: updateError } = await supabase
    .from('budget_periods')
    .update({
      income_amount: invoiceTotal + manualTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', periodId)
    .eq('household_id', householdId)

  if (updateError) throw new Error(`Failed to update period income: ${updateError.message}`)

  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/periods')
}
