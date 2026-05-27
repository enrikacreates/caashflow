import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserHouseholdId } from '@/lib/supabase/helpers'
import { isFullyPaid } from '@/lib/calculations'
import { getOwedAmount } from '@/lib/utils'
import type { PeriodExpense } from '@/lib/types'

/**
 * Year-to-date header stats for the profile/stat blobs.
 *  - earned: income received this calendar year (received invoices)
 *  - paid:   total funded/paid expenses this year (the pre-cleared stage), across this year's periods
 *  - owed:   current total debt balance (live, not YTD)
 *  - saved:  current savings total (live, not YTD)
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const householdId = await getUserHouseholdId()
  const year = new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  // --- Earned: received invoices dated this calendar year ---
  const { data: invoices } = await supabase
    .from('invoices')
    .select('amount, status, actual_received_date, month')
    .eq('household_id', householdId)
    .eq('status', 'received')

  const invoiceEarned = (invoices ?? []).reduce((sum, inv) => {
    const dateStr = inv.actual_received_date ?? (inv.month ? `${inv.month}-01` : null)
    return dateStr && dateStr >= yearStart && dateStr <= yearEnd ? sum + (inv.amount ?? 0) : sum
  }, 0)

  // --- Plus manual/one-off income (gifts, sales, paybacks) that counts as income.
  //     Rows flagged exclude_from_reports (the "not income" flag) are left out. ---
  const { data: manual } = await supabase
    .from('period_manual_income')
    .select('amount, budget_periods ( period_month )')
    .eq('household_id', householdId)
    .eq('exclude_from_reports', false)

  const manualEarned = (manual ?? []).reduce((sum, row) => {
    const pm = (row.budget_periods as unknown as { period_month: string | null } | null)?.period_month
    return pm && pm >= yearStart && pm <= yearEnd ? sum + (Number(row.amount) || 0) : sum
  }, 0)

  const earned = invoiceEarned + manualEarned

  // --- Paid: total funded/paid expenses across this year's periods (pre-cleared stage) ---
  const { data: periods } = await supabase
    .from('budget_periods')
    .select('id')
    .eq('household_id', householdId)
    .gte('period_month', yearStart)
    .lte('period_month', yearEnd)

  const periodIds = (periods ?? []).map((p) => p.id)
  let paid = 0
  if (periodIds.length > 0) {
    const { data: expenses } = await supabase
      .from('period_expenses')
      .select('*')
      .eq('household_id', householdId)
      .in('period_id', periodIds)

    const expenseList = (expenses ?? []) as PeriodExpense[]
    // Attach split sub-payments + spend-ledger entries so getPaidSoFar can sum them
    const expenseIds = expenseList.map((e) => e.id)
    if (expenseIds.length > 0) {
      const { data: payments } = await supabase
        .from('period_expense_payments')
        .select('*')
        .in('period_expense_id', expenseIds)
      const byExpense = new Map<string, typeof payments>()
      for (const p of payments ?? []) {
        const arr = byExpense.get(p.period_expense_id) ?? []
        arr.push(p)
        byExpense.set(p.period_expense_id, arr)
      }
      for (const e of expenseList) e.payments = (byExpense.get(e.id) ?? []) as PeriodExpense['payments']

      const { data: adjustments } = await supabase
        .from('period_expense_adjustments')
        .select('*')
        .in('period_expense_id', expenseIds)
      const adjByExpense = new Map<string, typeof adjustments>()
      for (const a of adjustments ?? []) {
        const arr = adjByExpense.get(a.period_expense_id) ?? []
        arr.push(a)
        adjByExpense.set(a.period_expense_id, arr)
      }
      for (const e of expenseList) e.adjustments = (adjByExpense.get(e.id) ?? []) as PeriodExpense['adjustments']
    }
    const owedOf = (e: PeriodExpense) =>
      e.is_split ? (e.payments ?? []).reduce((s, p) => s + p.amount, 0) : getOwedAmount(e)
    paid = expenseList.reduce((sum, e) => sum + (isFullyPaid(e) ? owedOf(e) : 0), 0)
  }

  // --- Owed: current total debt balance ---
  const { data: debts } = await supabase
    .from('debts')
    .select('current_balance')
    .eq('household_id', householdId)
  const owed = (debts ?? []).reduce((sum, d) => sum + (d.current_balance ?? 0), 0)

  // --- Saved: current savings total ---
  const { data: goals } = await supabase
    .from('savings_goals')
    .select('current_amount')
    .eq('household_id', householdId)
  const saved = (goals ?? []).reduce((sum, g) => sum + (g.current_amount ?? 0), 0)

  return NextResponse.json({ year, earned, paid, owed, saved })
}
