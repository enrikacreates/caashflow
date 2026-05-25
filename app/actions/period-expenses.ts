'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserHouseholdId } from '@/lib/supabase/helpers'
import { calculateDeductions } from '@/lib/calculations'
import { revalidatePath } from 'next/cache'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Log the deductions for a just-settled income item into the period ledger.
 * Each deduction is the settled amount × that deduction's effective percentage
 * (so % and fixed-$ rates both allocate proportionally). Computed against the
 * period's current income, before recalc excludes the settled item.
 */
async function logDeductionContribution(
  supabase: SupabaseServer,
  householdId: string,
  periodId: string,
  sourceKind: 'manual' | 'invoice',
  sourceId: string,
  sourceLabel: string | null,
  incomeAmount: number
) {
  const { data: period } = await supabase
    .from('budget_periods')
    .select('income_amount, deduction_overrides')
    .eq('id', periodId)
    .eq('household_id', householdId)
    .single()
  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .eq('household_id', householdId)
    .single()
  if (!period || !settings) return

  const ded = calculateDeductions(Number(period.income_amount) || 0, settings, period.deduction_overrides)
  const p = ded.percentages
  const A = incomeAmount

  await supabase.from('period_deduction_contributions').upsert(
    {
      household_id: householdId,
      period_id: periodId,
      source_kind: sourceKind,
      source_id: sourceId,
      source_label: sourceLabel,
      income_amount: A,
      tithe: round2((A * p.titheP) / 100),
      savings: round2((A * p.savingsP) / 100),
      tax: round2((A * p.taxP) / 100),
      profit: round2((A * p.profitP) / 100),
      fun_money: round2((A * p.funMoneyP) / 100),
    },
    { onConflict: 'period_id,source_kind,source_id' }
  )
}

async function removeDeductionContribution(
  supabase: SupabaseServer,
  householdId: string,
  sourceKind: 'manual' | 'invoice',
  sourceId: string
) {
  await supabase
    .from('period_deduction_contributions')
    .delete()
    .eq('household_id', householdId)
    .eq('source_kind', sourceKind)
    .eq('source_id', sourceId)
}

export async function markExpensePaid(expenseId: string): Promise<{
  exceedsMinimum: boolean
  savingsExceedsMonthly: boolean
  savingsAchieved: boolean
}> {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  // Fetch the expense to check for linked debt or savings goal
  const { data: expense, error: fetchError } = await supabase
    .from('period_expenses')
    .select('debt_id, savings_goal_id, amount_override, default_amount, paid_amount, period_id')
    .eq('id', expenseId)
    .eq('household_id', householdId)
    .single()

  if (fetchError || !expense) throw new Error('Expense not found')

  const effectiveAmount = expense.amount_override ?? expense.default_amount

  // Mark as paid and set paid_amount to full effective amount
  const { error: updateError } = await supabase
    .from('period_expenses')
    .update({ paid: true, paid_amount: effectiveAmount, updated_at: new Date().toISOString() })
    .eq('id', expenseId)
    .eq('household_id', householdId)

  if (updateError) throw new Error(`Failed to mark expense paid: ${updateError.message}`)

  let exceedsMinimum = false
  let savingsExceedsMonthly = false
  let savingsAchieved = false

  // Delta = what's newly being paid (avoid double-counting on re-check)
  const paymentDelta = effectiveAmount - (expense.paid_amount ?? 0)
  const paymentAmount = effectiveAmount

  if (expense.debt_id && paymentDelta > 0) {
    const { data: debt, error: debtFetchError } = await supabase
      .from('debts')
      .select('current_balance, minimum_payment')
      .eq('id', expense.debt_id)
      .eq('household_id', householdId)
      .single()

    if (!debtFetchError && debt) {
      const newBalance = Math.max(0, debt.current_balance - paymentDelta)
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

  if (expense.savings_goal_id && paymentDelta > 0) {
    const { data: goal, error: goalFetchError } = await supabase
      .from('savings_goals')
      .select('current_amount, target_amount, monthly_contribution')
      .eq('id', expense.savings_goal_id)
      .eq('household_id', householdId)
      .single()

    if (!goalFetchError && goal) {
      const newAmount = goal.current_amount + paymentDelta
      savingsExceedsMonthly =
        goal.monthly_contribution !== null && paymentAmount > goal.monthly_contribution
      savingsAchieved = newAmount >= goal.target_amount

      await supabase
        .from('savings_goals')
        .update({ current_amount: newAmount, updated_at: new Date().toISOString() })
        .eq('id', expense.savings_goal_id)
        .eq('household_id', householdId)

      revalidatePath('/savings')
    }
  }

  revalidatePath(`/periods/${expense.period_id}`)
  revalidatePath('/periods')
  return { exceedsMinimum, savingsExceedsMonthly, savingsAchieved }
}

export async function updateExpenseField(
  expenseId: string,
  field: string,
  value: boolean | number | string | null
) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data, error } = await supabase
    .from('period_expenses')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', expenseId)
    .eq('household_id', householdId)
    .select('period_id')
    .single()

  if (error) throw new Error(`Failed to update expense field: ${error.message}`)

  revalidatePath('/periods')
  if (data?.period_id) revalidatePath(`/periods/${data.period_id}`)
  revalidatePath('/')
}

/**
 * Edit a period expense's details in place (this budget's copy).
 * Pass `alsoMasterBaseItemId` to also apply the same edits to the recurring
 * baseline template (base_budget_items) — so future budgets inherit them too.
 */
export async function updatePeriodExpenseDetails(
  expenseId: string,
  fields: {
    name: string
    default_amount: number
    account: string | null
    priority_category: string | null
    due_day: number | null
    pay_url: string | null
    notes: string | null
  },
  alsoMasterBaseItemId?: string | null
) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data, error } = await supabase
    .from('period_expenses')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', expenseId)
    .eq('household_id', householdId)
    .select('period_id')
    .single()

  if (error) throw new Error(`Failed to update expense: ${error.message}`)

  if (alsoMasterBaseItemId) {
    const { error: masterErr } = await supabase
      .from('base_budget_items')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', alsoMasterBaseItemId)
      .eq('household_id', householdId)
    if (masterErr) throw new Error(`Failed to update baseline item: ${masterErr.message}`)
    revalidatePath('/base-budget')
  }

  revalidatePath('/periods')
  if (data?.period_id) revalidatePath(`/periods/${data.period_id}`)
  revalidatePath('/')
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

/** Mark (or clear) a deduction type (tithe|savings|tax|profit|fun_money) as set aside/paid for this period. */
export async function setDeductionPaid(periodId: string, key: string, done: boolean) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data: row } = await supabase
    .from('budget_periods')
    .select('deduction_paid')
    .eq('id', periodId)
    .eq('household_id', householdId)
    .single()

  const next = { ...((row?.deduction_paid ?? {}) as Record<string, boolean>) }
  if (done) next[key] = true
  else delete next[key]

  const { error } = await supabase
    .from('budget_periods')
    .update({ deduction_paid: next, updated_at: new Date().toISOString() })
    .eq('id', periodId)
    .eq('household_id', householdId)
  if (error) throw new Error(`Failed to update deduction status: ${error.message}`)

  revalidatePath(`/periods/${periodId}`)
}

/** Toggle whether a deduction (e.g. Giving) is taken as cash this period. */
export async function setDeductionCash(periodId: string, key: string, on: boolean) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data: row } = await supabase
    .from('budget_periods')
    .select('deduction_cash')
    .eq('id', periodId)
    .eq('household_id', householdId)
    .single()

  const next = { ...((row?.deduction_cash ?? {}) as Record<string, boolean>) }
  if (on) next[key] = true
  else delete next[key]

  const { error } = await supabase
    .from('budget_periods')
    .update({ deduction_cash: next, updated_at: new Date().toISOString() })
    .eq('id', periodId)
    .eq('household_id', householdId)
  if (error) throw new Error(`Failed to update deduction cash flag: ${error.message}`)

  revalidatePath(`/periods/${periodId}`)
}

/** Mark (or clear) an account's transfer as completed for this period. */
export async function setAccountTransferDone(periodId: string, accountName: string, done: boolean) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  // Upsert (don't delete) so the row's cash_done flag is preserved.
  const { error } = await supabase
    .from('period_account_transfers')
    .upsert(
      { period_id: periodId, household_id: householdId, account_name: accountName, transferred: done, updated_at: new Date().toISOString() },
      { onConflict: 'period_id,account_name' }
    )
  if (error) throw new Error(`Failed to update transfer: ${error.message}`)

  revalidatePath(`/periods/${periodId}`)
}

/** Mark (or clear) that an account's cash has been withdrawn for this period. */
export async function setAccountCashDone(periodId: string, accountName: string, done: boolean) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('period_account_transfers')
    .upsert(
      { period_id: periodId, household_id: householdId, account_name: accountName, cash_done: done, updated_at: new Date().toISOString() },
      { onConflict: 'period_id,account_name' }
    )
  if (error) throw new Error(`Failed to update cash status: ${error.message}`)

  revalidatePath(`/periods/${periodId}`)
}

export async function updateDeductionOverrides(
  periodId: string,
  overrides: Record<string, number | null>
) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  // Fetch current overrides so we merge instead of replace
  const { data: period, error: fetchError } = await supabase
    .from('budget_periods')
    .select('deduction_overrides')
    .eq('id', periodId)
    .eq('household_id', householdId)
    .single()

  if (fetchError) throw new Error(`Failed to fetch period overrides: ${fetchError.message}`)

  const current = (period?.deduction_overrides as Record<string, number | null>) || {}
  const merged = { ...current, ...overrides }

  // Remove null keys (null = reset to default)
  for (const key of Object.keys(merged)) {
    if (merged[key] === null || merged[key] === undefined) {
      delete merged[key]
    }
  }

  const { error } = await supabase
    .from('budget_periods')
    .update({
      deduction_overrides: merged,
      updated_at: new Date().toISOString(),
    })
    .eq('id', periodId)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update deduction overrides: ${error.message}`)

  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/periods')
}

/** Capture an adjustment line (amount + optional note) into the period ledger. */
export async function addAdjustment(periodId: string, amount: number, note: string | null) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data: existing } = await supabase
    .from('period_adjustments')
    .select('sort_order')
    .eq('period_id', periodId)
    .eq('household_id', householdId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  const { error } = await supabase.from('period_adjustments').insert({
    household_id: householdId,
    period_id: periodId,
    amount,
    note,
    sort_order: nextOrder,
  })

  if (error) throw new Error(`Failed to add adjustment: ${error.message}`)
  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/')
}

/** Update an adjustment line (signed amount and/or note). */
export async function updateAdjustment(
  id: string,
  periodId: string,
  data: Partial<{ amount: number; note: string | null }>
) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('period_adjustments')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update adjustment: ${error.message}`)
  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/')
}

/** Remove an adjustment line. */
export async function removeAdjustment(id: string, periodId: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('period_adjustments')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to remove adjustment: ${error.message}`)
  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/')
}

/** Add an ad-hoc, this-period-only expense (not tied to the settings baseline). */
export async function addOneTimeExpense(
  periodId: string,
  data: {
    name: string
    default_amount: number
    account: string | null
    priority_category: string | null
    due_day: number | null
  }
) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data: existing } = await supabase
    .from('period_expenses')
    .select('sort_order')
    .eq('period_id', periodId)
    .eq('household_id', householdId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  const { error } = await supabase.from('period_expenses').insert({
    period_id: periodId,
    household_id: householdId,
    base_item_id: null,
    name: data.name,
    default_amount: data.default_amount,
    account: data.account,
    priority_category: data.priority_category,
    due_day: data.due_day,
    frequency: 'One-Time',
    auto_pay: false,
    pay_url: null,
    notes: null,
    tags: [],
    debt_id: null,
    savings_goal_id: null,
    pay_now: false,
    transferred: false,
    paid: false,
    cleared: false,
    amount_override: null,
    override_notes: null,
    paid_amount: 0,
    sort_order: nextOrder,
  })

  if (error) throw new Error(`Failed to add one-time expense: ${error.message}`)
  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/')
}

/** Delete a period expense (used for ad-hoc one-time items; sub-payments cascade). */
export async function removePeriodExpense(id: string, periodId: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('period_expenses')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to remove expense: ${error.message}`)
  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/')
}

// ── Split / sub-payments ─────────────────────────────────────────────────────

/** Toggle whether an expense is split into sub-payments. Seeds one row when enabling. */
export async function toggleExpenseSplit(expenseId: string, periodId: string, isSplit: boolean) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('period_expenses')
    .update({ is_split: isSplit, updated_at: new Date().toISOString() })
    .eq('id', expenseId)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to toggle split: ${error.message}`)

  if (isSplit) {
    const { data: existing } = await supabase
      .from('period_expense_payments')
      .select('id')
      .eq('period_expense_id', expenseId)
      .eq('household_id', householdId)
      .limit(1)

    if (!existing || existing.length === 0) {
      await supabase.from('period_expense_payments').insert({
        household_id: householdId,
        period_expense_id: expenseId,
        label: 'Payment 1',
        amount: 0,
        sort_order: 0,
      })
    }
  }

  revalidatePath(`/periods/${periodId}`)
}

/** Add a new sub-payment row to a split expense. */
export async function addExpensePayment(expenseId: string, periodId: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data: existing } = await supabase
    .from('period_expense_payments')
    .select('sort_order')
    .eq('period_expense_id', expenseId)
    .eq('household_id', householdId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  const { error } = await supabase.from('period_expense_payments').insert({
    household_id: householdId,
    period_expense_id: expenseId,
    label: `Payment ${nextOrder + 1}`,
    amount: 0,
    sort_order: nextOrder,
  })

  if (error) throw new Error(`Failed to add payment: ${error.message}`)
  revalidatePath(`/periods/${periodId}`)
}

/** Update a sub-payment. Marking it paid/unpaid ripples to a linked debt or savings goal. */
export async function updateExpensePayment(
  paymentId: string,
  periodId: string,
  data: Partial<{
    label: string | null
    amount: number
    due_day: number | null
    pay_now: boolean
    transferred: boolean
    paid: boolean
    cleared: boolean
  }>
): Promise<{ savingsAchieved: boolean; exceedsMinimum: boolean; savingsExceedsMonthly: boolean }> {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  let savingsAchieved = false
  let exceedsMinimum = false
  let savingsExceedsMonthly = false

  if (data.paid !== undefined) {
    const { data: payment } = await supabase
      .from('period_expense_payments')
      .select('amount, paid, period_expense_id')
      .eq('id', paymentId)
      .eq('household_id', householdId)
      .single()

    if (payment && payment.paid !== data.paid) {
      const { data: parent } = await supabase
        .from('period_expenses')
        .select('debt_id, savings_goal_id')
        .eq('id', payment.period_expense_id)
        .eq('household_id', householdId)
        .single()

      const amt = data.amount !== undefined ? data.amount : payment.amount
      const delta = data.paid ? amt : -amt

      if (parent?.debt_id && delta !== 0) {
        const { data: debt } = await supabase
          .from('debts')
          .select('current_balance, minimum_payment')
          .eq('id', parent.debt_id)
          .eq('household_id', householdId)
          .single()
        if (debt) {
          exceedsMinimum = debt.minimum_payment !== null && delta > debt.minimum_payment
          await supabase
            .from('debts')
            .update({ current_balance: Math.max(0, debt.current_balance - delta), updated_at: new Date().toISOString() })
            .eq('id', parent.debt_id)
            .eq('household_id', householdId)
          revalidatePath('/debts')
        }
      }

      if (parent?.savings_goal_id && delta !== 0) {
        const { data: goal } = await supabase
          .from('savings_goals')
          .select('current_amount, target_amount, monthly_contribution')
          .eq('id', parent.savings_goal_id)
          .eq('household_id', householdId)
          .single()
        if (goal) {
          const newAmount = Math.max(0, goal.current_amount + delta)
          savingsExceedsMonthly = goal.monthly_contribution !== null && delta > goal.monthly_contribution
          savingsAchieved = newAmount >= goal.target_amount && goal.current_amount < goal.target_amount
          await supabase
            .from('savings_goals')
            .update({ current_amount: newAmount, updated_at: new Date().toISOString() })
            .eq('id', parent.savings_goal_id)
            .eq('household_id', householdId)
          revalidatePath('/savings')
        }
      }
    }
  }

  const { error } = await supabase
    .from('period_expense_payments')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', paymentId)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update payment: ${error.message}`)

  revalidatePath(`/periods/${periodId}`)
  return { savingsAchieved, exceedsMinimum, savingsExceedsMonthly }
}

/** Remove a sub-payment row. */
export async function removeExpensePayment(paymentId: string, periodId: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('period_expense_payments')
    .delete()
    .eq('id', paymentId)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to remove payment: ${error.message}`)
  revalidatePath(`/periods/${periodId}`)
}

/**
 * "Clear" doubles as the terminal settle: a cleared bill is finished, so it drops
 * out of the live balance (pay_now off) and seals the line (is_complete + locked).
 * Unchecking reopens it. Done remains available as a manual seal.
 */
export async function setExpenseCleared(expenseId: string, periodId: string, value: boolean) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const update: Record<string, unknown> = {
    cleared: value,
    is_complete: value,
    updated_at: new Date().toISOString(),
  }
  if (value) update.pay_now = false

  const { error } = await supabase
    .from('period_expenses')
    .update(update)
    .eq('id', expenseId)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update cleared: ${error.message}`)
  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/')
}

/**
 * Flag a line as overdue (carried over from a prior period).
 * On flag, a non-split bill auto-doubles its amount (last month + this month) and
 * marks itself to-pay so this period's income covers it. Clearing restores the default.
 */
export async function toggleExpenseOverdue(expenseId: string, periodId: string, value: boolean) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const update: Record<string, unknown> = { is_overdue: value, updated_at: new Date().toISOString() }

  if (value) {
    const { data: exp } = await supabase
      .from('period_expenses')
      .select('default_amount, is_split')
      .eq('id', expenseId)
      .eq('household_id', householdId)
      .single()
    if (exp && !exp.is_split) {
      update.amount_override = exp.default_amount * 2
      update.pay_now = true
    }
  } else {
    // Clearing the flag undoes what flagging did: restore the default amount and drop it from pay-now.
    update.amount_override = null
    update.pay_now = false
  }

  const { error } = await supabase
    .from('period_expenses')
    .update(update)
    .eq('id', expenseId)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to toggle overdue: ${error.message}`)
  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/')
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

  // Auto-flag the invoice as budgeted — assigning it to any period marks it
  await supabase
    .from('invoices')
    .update({ budgeted: true, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)

  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/periods')
  revalidatePath('/invoices')
}

export async function unlinkInvoiceFromPeriod(periodId: string, invoiceId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('period_linked_invoices')
    .delete()
    .eq('period_id', periodId)
    .eq('invoice_id', invoiceId)

  if (error) throw new Error(`Failed to unlink invoice from period: ${error.message}`)

  // Check if invoice is still linked to any other periods — clear budgeted flag only if not
  const { count } = await supabase
    .from('period_linked_invoices')
    .select('*', { count: 'exact', head: true })
    .eq('invoice_id', invoiceId)

  if ((count ?? 0) === 0) {
    await supabase
      .from('invoices')
      .update({ budgeted: false, updated_at: new Date().toISOString() })
      .eq('id', invoiceId)
  }

  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/periods')
  revalidatePath('/invoices')
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

  // Sum linked invoice amounts where status is 'received' — skip ones marked done
  const { data: linkedInvoices, error: linkedError } = await supabase
    .from('period_linked_invoices')
    .select('invoice_id, is_done, invoices(amount, status)')
    .eq('period_id', periodId)

  if (linkedError) throw new Error(`Failed to fetch linked invoices: ${linkedError.message}`)

  const invoiceTotal = (linkedInvoices || []).reduce((sum, link) => {
    if (link.is_done) return sum
    const invoice = link.invoices as unknown as { amount: number | string; status: string }
    if (invoice && invoice.status === 'received') {
      return sum + (Number(invoice.amount) || 0)
    }
    return sum
  }, 0)

  // Sum manual income amounts — skip ones marked done
  const { data: manualIncomeRows, error: manualError } = await supabase
    .from('period_manual_income')
    .select('amount, is_done')
    .eq('period_id', periodId)
    .eq('household_id', householdId)

  if (manualError) throw new Error(`Failed to fetch manual income: ${manualError.message}`)

  const manualTotal = (manualIncomeRows || []).reduce(
    (sum, row) => (row.is_done ? sum : sum + (Number(row.amount) || 0)),
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
  revalidatePath('/')
}

/** Mark a manual income entry done (or active) — recalcs the period income. */
export async function toggleManualIncomeDone(id: string, periodId: string, value: boolean) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { error } = await supabase
    .from('period_manual_income')
    .update({ is_done: value })
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update manual income: ${error.message}`)

  if (value) {
    const { data: mi } = await supabase
      .from('period_manual_income')
      .select('amount, description')
      .eq('id', id)
      .eq('household_id', householdId)
      .single()
    if (mi) {
      await logDeductionContribution(supabase, householdId, periodId, 'manual', id, mi.description, Number(mi.amount) || 0)
    }
  } else {
    await removeDeductionContribution(supabase, householdId, 'manual', id)
  }

  await recalculatePeriodIncome(periodId)
}

/** Mark a linked invoice done (or active) for this period — recalcs the period income. */
export async function toggleLinkedInvoiceDone(linkId: string, periodId: string, value: boolean) {
  const supabase = await createClient()

  // period_linked_invoices is household-scoped via RLS (no household_id column)
  const { error } = await supabase
    .from('period_linked_invoices')
    .update({ is_done: value })
    .eq('id', linkId)

  if (error) throw new Error(`Failed to update linked invoice: ${error.message}`)

  if (value) {
    const householdId = await getUserHouseholdId()
    const { data: link } = await supabase
      .from('period_linked_invoices')
      .select('invoices(amount, client_name, status)')
      .eq('id', linkId)
      .single()
    const inv = link?.invoices as unknown as { amount: number | string; client_name: string; status: string } | null
    if (inv && inv.status === 'received') {
      await logDeductionContribution(supabase, householdId, periodId, 'invoice', linkId, inv.client_name, Number(inv.amount) || 0)
    }
  } else {
    const householdId = await getUserHouseholdId()
    await removeDeductionContribution(supabase, householdId, 'invoice', linkId)
  }

  await recalculatePeriodIncome(periodId)
}

/** Bulk-set "transferred" on every to-pay item (single expenses + pay-checked installments). */
export async function bulkSetTransferred(periodId: string, value: boolean) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  await supabase
    .from('period_expenses')
    .update({ transferred: value, updated_at: new Date().toISOString() })
    .eq('period_id', periodId).eq('household_id', householdId)
    .eq('pay_now', true).eq('is_split', false).eq('is_complete', false)

  const { data: splits } = await supabase
    .from('period_expenses')
    .select('id').eq('period_id', periodId).eq('household_id', householdId)
    .eq('is_split', true).eq('is_complete', false)
  const splitIds = (splits ?? []).map((e) => e.id)
  if (splitIds.length) {
    await supabase
      .from('period_expense_payments')
      .update({ transferred: value, updated_at: new Date().toISOString() })
      .eq('household_id', householdId).eq('pay_now', true).in('period_expense_id', splitIds)
  }

  revalidatePath(`/periods/${periodId}`)
}

/** Bulk-mark "paid" on every unpaid to-pay item — applies debt/savings ripples per item. */
export async function bulkMarkPaid(periodId: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data: exps } = await supabase
    .from('period_expenses')
    .select('id').eq('period_id', periodId).eq('household_id', householdId)
    .eq('pay_now', true).eq('is_split', false).eq('paid', false).eq('is_complete', false)
  for (const e of exps ?? []) {
    await markExpensePaid(e.id)
  }

  const { data: splits } = await supabase
    .from('period_expenses')
    .select('id').eq('period_id', periodId).eq('household_id', householdId)
    .eq('is_split', true).eq('is_complete', false)
  const splitIds = (splits ?? []).map((e) => e.id)
  if (splitIds.length) {
    const { data: pays } = await supabase
      .from('period_expense_payments')
      .select('id').eq('household_id', householdId)
      .eq('pay_now', true).eq('paid', false).in('period_expense_id', splitIds)
    for (const p of pays ?? []) {
      await updateExpensePayment(p.id, periodId, { paid: true })
    }
  }

  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/')
}

/**
 * "Settle & reset" — the balanced-budget moment within a period.
 * Clears every to-pay item (drops it from the live balance + locks it) and marks all
 * active income as Budgeted (logging its deductions to the ledger). Nothing is deleted;
 * rows can be reopened individually. Result: Pay Now → $0 and active income → $0, ready
 * for the next check.
 */
export async function settleAndResetPeriod(periodId: string) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  // 1. Settle to-pay single expenses that have been PAID (unpaid ones stay live)
  await supabase
    .from('period_expenses')
    .update({ cleared: true, is_complete: true, pay_now: false, updated_at: new Date().toISOString() })
    .eq('period_id', periodId).eq('household_id', householdId)
    .eq('pay_now', true).eq('paid', true).eq('is_split', false)

  // 2. Settle PAID to-pay installments; seal a split only once it has no to-pay left
  const { data: splits } = await supabase
    .from('period_expenses')
    .select('id').eq('period_id', periodId).eq('household_id', householdId).eq('is_split', true)
  const splitIds = (splits ?? []).map((e) => e.id)
  if (splitIds.length) {
    const { data: paidSubs } = await supabase
      .from('period_expense_payments')
      .select('id, period_expense_id')
      .eq('household_id', householdId).eq('pay_now', true).eq('paid', true).in('period_expense_id', splitIds)
    if (paidSubs && paidSubs.length) {
      await supabase
        .from('period_expense_payments')
        .update({ cleared: true, pay_now: false, updated_at: new Date().toISOString() })
        .in('id', paidSubs.map((p) => p.id))
      // Seal only the split parents that now have no remaining to-pay installments.
      const affected = [...new Set(paidSubs.map((p) => p.period_expense_id))]
      const { data: remaining } = await supabase
        .from('period_expense_payments')
        .select('period_expense_id')
        .eq('household_id', householdId).eq('pay_now', true).in('period_expense_id', affected)
      const stillActive = new Set((remaining ?? []).map((r) => r.period_expense_id))
      const fullySettled = affected.filter((id) => !stillActive.has(id))
      if (fullySettled.length) {
        await supabase
          .from('period_expenses')
          .update({ is_complete: true, updated_at: new Date().toISOString() })
          .eq('household_id', householdId).in('id', fullySettled)
      }
    }
  }

  // 3. Budget out active income — log each contribution (at the current full income) then mark done
  const { data: activeManual } = await supabase
    .from('period_manual_income')
    .select('id, amount, description').eq('period_id', periodId).eq('household_id', householdId).eq('is_done', false)
  for (const mi of activeManual ?? []) {
    await logDeductionContribution(supabase, householdId, periodId, 'manual', mi.id, mi.description, Number(mi.amount) || 0)
  }
  if (activeManual && activeManual.length) {
    await supabase.from('period_manual_income').update({ is_done: true })
      .eq('period_id', periodId).eq('household_id', householdId).eq('is_done', false)
  }

  const { data: activeLinks } = await supabase
    .from('period_linked_invoices')
    .select('id, invoices(amount, client_name, status)').eq('period_id', periodId).eq('is_done', false)
  for (const link of activeLinks ?? []) {
    const inv = link.invoices as unknown as { amount: number | string; client_name: string; status: string } | null
    if (inv && inv.status === 'received') {
      await logDeductionContribution(supabase, householdId, periodId, 'invoice', link.id, inv.client_name, Number(inv.amount) || 0)
    }
  }
  if (activeLinks && activeLinks.length) {
    await supabase.from('period_linked_invoices').update({ is_done: true }).eq('period_id', periodId).eq('is_done', false)
  }

  // 4. Clear this check's income adjustments — they belonged to the check we just budgeted out.
  await supabase.from('period_adjustments')
    .delete().eq('period_id', periodId).eq('household_id', householdId)

  // 5. Reset per-cycle completion checkmarks — next check starts fresh
  await supabase.from('budget_periods')
    .update({ deduction_paid: {}, updated_at: new Date().toISOString() })
    .eq('id', periodId).eq('household_id', householdId)
  await supabase.from('period_account_transfers')
    .delete().eq('period_id', periodId).eq('household_id', householdId)

  await recalculatePeriodIncome(periodId)
  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/')
}
