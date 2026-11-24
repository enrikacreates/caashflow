'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserTeamId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'
import type { DeductionOverrides } from '@/lib/types'
import { clearAllPayNow } from '@/app/actions/period-expenses'

const PERCENT_KEYS: (keyof DeductionOverrides)[] = [
  'tithe_percentage', 'savings_percentage', 'tax_percentage', 'profit_percentage', 'fun_money_percentage',
]

function revalidatePeriod(periodId: string) {
  revalidatePath(`/periods/${periodId}`)
  revalidatePath('/periods')
  revalidatePath('/')
}

/**
 * Open the next budgeting session for this month. Earlier sessions keep their
 * income and the bills they funded; unfunded bills stay in the month pool and
 * show up in the new session. Rate (%) overrides and cash preferences carry
 * forward; fixed-$ overrides and set-aside checkmarks start fresh.
 */
export async function startNewSession(periodId: string, sessionDate: string): Promise<number> {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { data: latest, error: latestError } = await supabase
    .from('budget_sessions')
    .select('seq, deduction_overrides, deduction_cash')
    .eq('period_id', periodId)
    .eq('team_id', teamId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestError) throw new Error(`Failed to load sessions: ${latestError.message}`)

  const prevOverrides = (latest?.deduction_overrides ?? {}) as DeductionOverrides
  const carried: DeductionOverrides = {}
  for (const key of PERCENT_KEYS) {
    if (prevOverrides[key] !== undefined) carried[key] = prevOverrides[key]
  }

  const seq = (latest?.seq ?? 0) + 1
  const { error } = await supabase.from('budget_sessions').insert({
    team_id: teamId,
    period_id: periodId,
    seq,
    session_date: sessionDate,
    deduction_overrides: carried,
    deduction_cash: latest?.deduction_cash ?? {},
  })
  if (error) throw new Error(`Failed to start session: ${error.message}`)

  await refillWeeklyBills(supabase, teamId, periodId)
  revalidatePeriod(periodId)
  return seq
}

/**
 * Weekly bills (Groceries, Tesla Energy) come back with every new check: once a weekly line
 * has been settled, a fresh unfunded copy at the Baseline amount joins the month pool. A
 * weekly bill that still has an open line is left alone, so it never doubles up.
 */
async function refillWeeklyBills(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teamId: string,
  periodId: string
) {
  const { data: lines, error } = await supabase
    .from('period_expenses')
    .select('*')
    .eq('period_id', periodId)
    .eq('team_id', teamId)
    .eq('frequency', 'Weekly')
    .not('base_item_id', 'is', null)
    .order('created_at', { ascending: false })
  if (error || !lines?.length) return

  const isOpen = (l: { is_complete: boolean; cleared: boolean; paid_outside: boolean | null }) =>
    !l.is_complete && !l.cleared && !l.paid_outside
  const byItem = new Map<string, typeof lines>()
  for (const l of lines) byItem.set(l.base_item_id, [...(byItem.get(l.base_item_id) ?? []), l])
  const settled = [...byItem.entries()].filter(([, ls]) => !ls.some(isOpen)).map(([id, ls]) => ({ id, latest: ls[0] }))
  if (!settled.length) return

  // Baseline sets the amount; a bill archived or moved off Weekly there doesn't come back
  const { data: items } = await supabase
    .from('base_budget_items')
    .select('id, default_amount, frequency, archived_at')
    .eq('team_id', teamId)
    .in('id', settled.map((s) => s.id))
  const live = new Map((items ?? []).filter((i) => i.frequency === 'Weekly' && !i.archived_at).map((i) => [i.id, i]))

  const fresh = settled.flatMap(({ id, latest: l }) => {
    const item = live.get(id)
    if (!item) return []
    return [{
      period_id: periodId,
      team_id: teamId,
      base_item_id: id,
      name: l.name,
      default_amount: item.default_amount,
      due_day: l.due_day,
      account: l.account,
      priority_category: l.priority_category,
      frequency: 'Weekly',
      auto_pay: l.auto_pay,
      pay_url: l.pay_url,
      notes: l.notes,
      tags: l.tags ?? [],
      debt_id: l.debt_id,
      savings_goal_id: l.savings_goal_id,
      track_spending: l.track_spending ?? false,
      is_cash: l.is_cash ?? false,
      sort_order: l.sort_order,
      pay_now: false,
      transferred: false,
      paid: false,
      cleared: false,
      amount_override: null,
      paid_amount: 0,
    }]
  })
  if (fresh.length) await supabase.from('period_expenses').insert(fresh)
}

/**
 * Close out the newest session and start fresh: every bill checked to Pay in it is settled
 * (paid and cleared, like the Clear all button), then a new $0 session opens. Unchecked bills
 * were never funded, so they move along to the new session. Any bill can be reopened from its row.
 */
export async function closeOutAndStartSession(periodId: string, sessionId: string, sessionDate: string): Promise<number> {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { data: newest, error } = await supabase
    .from('budget_sessions')
    .select('id')
    .eq('period_id', periodId)
    .eq('team_id', teamId)
    .order('seq', { ascending: false })
    .limit(1)
    .single()
  if (error) throw new Error(`Failed to load sessions: ${error.message}`)
  if (newest.id !== sessionId) throw new Error('Only the newest session can be closed out')

  await clearAllPayNow(periodId, sessionId)
  return startNewSession(periodId, sessionDate)
}

/** Rename a session and/or change its date. An empty name falls back to "S{seq}". */
export async function updateSession(
  sessionId: string,
  periodId: string,
  data: { name?: string | null; session_date?: string }
) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.name !== undefined) update.name = data.name?.trim() || null
  if (data.session_date) update.session_date = data.session_date

  const { error } = await supabase
    .from('budget_sessions')
    .update(update)
    .eq('id', sessionId)
    .eq('team_id', teamId)
  if (error) throw new Error(`Failed to update session: ${error.message}`)

  revalidatePeriod(periodId)
}

/**
 * Remove the newest session when it was opened by mistake. Only allowed while it
 * has no income, adjustments, or funded bills — so nothing is ever lost.
 */
export async function removeEmptySession(sessionId: string, periodId: string) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { data: sessions } = await supabase
    .from('budget_sessions')
    .select('id, seq')
    .eq('period_id', periodId)
    .eq('team_id', teamId)
    .order('seq', { ascending: false })
  if (!sessions || sessions.length < 2 || sessions[0].id !== sessionId) {
    throw new Error('Only the newest session can be removed, and a budget always keeps one session')
  }

  const counts = await Promise.all(
    ['period_manual_income', 'period_linked_invoices', 'period_adjustments', 'period_expenses', 'period_expense_payments'].map(
      (table) => supabase.from(table).select('id', { count: 'exact', head: true }).eq('session_id', sessionId)
    )
  )
  if (counts.some((c) => (c.count ?? 0) > 0)) {
    throw new Error('This session already has income or funded bills')
  }

  const { error } = await supabase.from('budget_sessions').delete().eq('id', sessionId).eq('team_id', teamId)
  if (error) throw new Error(`Failed to remove session: ${error.message}`)

  revalidatePeriod(periodId)
}
