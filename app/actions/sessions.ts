'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserTeamId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'
import type { DeductionOverrides } from '@/lib/types'

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

  revalidatePeriod(periodId)
  return seq
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
