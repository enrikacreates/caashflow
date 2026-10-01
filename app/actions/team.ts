'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserTeamId, getAuthUser } from '@/lib/supabase/helpers'
import { DEFAULT_BASE_BUDGET, DEFAULT_REQUESTS } from '@/lib/constants'
import { revalidatePath } from 'next/cache'

// ── Member Management ──────────────────────────────────────────────────────

export async function getTeamMembers() {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { data, error } = await supabase.schema('public')
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch members: ${error.message}`)
  return data
}

export async function getTeamMemberAppAccess(memberId: string) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { data, error } = await supabase.schema('public')
    .from('team_app_access')
    .select('*')
    .eq('team_id', teamId)
    .eq('member_id', memberId)

  if (error) throw new Error(`Failed to fetch app access: ${error.message}`)
  return data ?? []
}

export async function setMemberAppAccess(memberId: string, appSchema: string, access: 'full' | 'read' | null) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()
  const user = await getAuthUser()
  if (!user) throw new Error('Not authenticated')

  // Verify caller is the owner
  const { data: self } = await supabase.schema('public')
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!self || self.role !== 'owner') throw new Error('Only the team owner can manage app access')

  if (access === null) {
    // Remove access (revoke)
    await supabase.schema('public')
      .from('team_app_access')
      .delete()
      .eq('member_id', memberId)
      .eq('app_schema', appSchema)
  } else {
    // Upsert access grant
    const { error } = await supabase.schema('public')
      .from('team_app_access')
      .upsert(
        { team_id: teamId, member_id: memberId, app_schema: appSchema, access },
        { onConflict: 'member_id,app_schema' }
      )
    if (error) throw new Error(`Failed to set app access: ${error.message}`)
  }

  revalidatePath('/settings')
}

export async function generateInviteLink(): Promise<string> {
  const supabase = await createClient()
  const teamId = await getUserTeamId()
  const user = await getAuthUser()

  // Expire any existing pending invites for this team
  await supabase.schema('public')
    .from('team_invites')
    .update({ status: 'expired' })
    .eq('team_id', teamId)
    .eq('status', 'pending')

  const { data, error } = await supabase.schema('public')
    .from('team_invites')
    .insert({
      team_id: teamId,
      invited_by: user?.id,
    })
    .select('token')
    .single()

  if (error) throw new Error(`Failed to create invite: ${error.message}`)
  return data.token
}

export async function removeTeamMember(memberId: string) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()
  const user = await getAuthUser()

  const { data: self } = await supabase.schema('public')
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', user?.id)
    .single()

  if (self?.id === memberId) throw new Error('You cannot remove yourself')

  // Remove app access grants first
  await supabase.schema('public')
    .from('team_app_access')
    .delete()
    .eq('member_id', memberId)

  const { error } = await supabase.schema('public')
    .from('team_members')
    .delete()
    .eq('id', memberId)
    .eq('team_id', teamId)

  if (error) throw new Error(`Failed to remove member: ${error.message}`)
  revalidatePath('/settings')
}

// ── Team Name + Leave ──────────────────────────────────────────────────

export async function renameTeam(teamId: string, name: string) {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) throw new Error('Not authenticated')

  const { data: membership } = await supabase.schema('public')
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'owner') {
    throw new Error('Only the team owner can rename it')
  }

  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name cannot be empty')

  const { error } = await supabase.schema('public')
    .from('teams')
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq('id', teamId)

  if (error) throw new Error(`Failed to rename team: ${error.message}`)
  revalidatePath('/settings')
}

export async function leaveTeam(teamId: string) {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) throw new Error('Not authenticated')

  const { data: membership } = await supabase.schema('public')
    .from('team_members')
    .select('id, role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership) throw new Error('You are not a member of this team')
  if (membership.role === 'owner') {
    throw new Error('Owners cannot leave their team. Transfer ownership first.')
  }

  // Remove app access grants
  await supabase.schema('public')
    .from('team_app_access')
    .delete()
    .eq('member_id', membership.id)

  const { error } = await supabase.schema('public')
    .from('team_members')
    .delete()
    .eq('id', membership.id)

  if (error) throw new Error(`Failed to leave team: ${error.message}`)
  revalidatePath('/settings')
}

export async function getUserTeamsWithNames() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase.schema('public')
    .from('team_members')
    .select('team_id, role, teams(id, name)')
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to fetch teams: ${error.message}`)
  return (data ?? []).map((m) => ({
    team_id: m.team_id,
    role: m.role as 'owner' | 'member',
    name: (m.teams as unknown as { id: string; name: string } | null)?.name ?? 'Unnamed',
  }))
}

// ── Invite Validation (used by join page) ─────────────────────────

export async function getInviteDetails(token: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.schema('public')
    .from('team_invites')
    .select('id, status, expires_at, team_id, teams(name)')
    .eq('token', token)
    .single()

  if (error || !data) return null
  if (data.status !== 'pending') return null
  if (new Date(data.expires_at) < new Date()) return null

  return {
    teamName: (data.teams as unknown as { name: string } | null)?.name ?? 'Your household',
    token,
  }
}

export async function seedBaseBudgetDefaults() {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

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

  const { error } = await supabase
    .from('base_budget_items')
    .insert(items)

  if (error) throw new Error(`Failed to seed base budget defaults: ${error.message}`)
}

export async function seedBudgetRequestDefaults() {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const requests = DEFAULT_REQUESTS.map((item) => ({
    team_id: teamId,
    name: item.name,
    amount: item.amount,
    priority_category: item.priority_category,
    status: item.status,
    tags: item.tags || [],
    notes: item.notes || null,
  }))

  const { error } = await supabase
    .from('budget_requests')
    .insert(requests)

  if (error) throw new Error(`Failed to seed budget request defaults: ${error.message}`)
}

export async function exportAllData() {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const [
    { data: settings },
    { data: baseBudgetItems },
    { data: budgetPeriods },
    { data: periodExpenses },
    { data: invoices },
    { data: budgetRequests },
    { data: periodLinkedInvoices },
    { data: periodManualIncome },
    { data: accounts },
    { data: priorityCategories },
  ] = await Promise.all([
    supabase.from('settings').select('*').eq('team_id', teamId),
    supabase.from('base_budget_items').select('*').eq('team_id', teamId).order('sort_order'),
    supabase.from('budget_periods').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
    supabase.from('period_expenses').select('*').eq('team_id', teamId),
    supabase.from('invoices').select('*').eq('team_id', teamId),
    supabase.from('budget_requests').select('*').eq('team_id', teamId),
    supabase.from('period_linked_invoices').select('*'),
    supabase.from('period_manual_income').select('*').eq('team_id', teamId),
    supabase.from('accounts').select('*').eq('team_id', teamId).order('sort_order'),
    supabase.from('priority_categories').select('*').eq('team_id', teamId).order('sort_order'),
  ])

  return {
    settings,
    baseBudgetItems,
    budgetPeriods,
    periodExpenses,
    invoices,
    budgetRequests,
    periodLinkedInvoices,
    periodManualIncome,
    accounts,
    priorityCategories,
    exportedAt: new Date().toISOString(),
  }
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

function convertKeysToSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const converted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    converted[camelToSnake(key)] = value
  }
  return converted
}

export async function importData(jsonString: string) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonString)
  } catch {
    throw new Error('Invalid JSON format')
  }

  if (parsed.settings) {
    const settingsRaw = Array.isArray(parsed.settings)
      ? parsed.settings[0]
      : parsed.settings

    if (settingsRaw) {
      const settings = convertKeysToSnakeCase(settingsRaw as Record<string, unknown>)
      const { error } = await supabase
        .from('settings')
        .upsert({
          team_id: teamId,
          tithe_percentage: settings.tithe_percentage ?? 10,
          savings_percentage: settings.savings_percentage ?? 2,
          tax_percentage: settings.tax_percentage ?? 25,
          profit_percentage: settings.profit_percentage ?? 10,
          fun_money_percentage: settings.fun_money_percentage ?? 2,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'team_id' })

      if (error) throw new Error(`Failed to import settings: ${error.message}`)
    }
  }

  if (parsed.baseBudgetItems || parsed.base_budget_items || parsed.baseBudget) {
    const rawItems = (parsed.baseBudgetItems || parsed.base_budget_items || parsed.baseBudget) as Record<string, unknown>[]

    if (Array.isArray(rawItems) && rawItems.length > 0) {
      await supabase
        .from('base_budget_items')
        .delete()
        .eq('team_id', teamId)

      const items = rawItems.map((raw, index) => {
        const item = convertKeysToSnakeCase(raw)
        return {
          team_id: teamId,
          name: item.name as string,
          default_amount: (item.default_amount as number) || 0,
          due_day: (item.due_day as number) ?? null,
          account: (item.account as string) || null,
          priority_category: (item.priority_category as string) || null,
          frequency: (item.frequency as string) || 'Monthly',
          auto_pay: Boolean(item.auto_pay),
          pay_url: (item.pay_url as string) || null,
          notes: (item.notes as string) || null,
          tags: Array.isArray(item.tags) ? item.tags : [],
          sort_order: (item.sort_order as number) ?? index,
        }
      })

      const { error } = await supabase.from('base_budget_items').insert(items)
      if (error) throw new Error(`Failed to import base budget items: ${error.message}`)
    }
  }

  if (parsed.invoices) {
    const rawInvoices = parsed.invoices as Record<string, unknown>[]

    if (Array.isArray(rawInvoices) && rawInvoices.length > 0) {
      await supabase
        .from('invoices')
        .delete()
        .eq('team_id', teamId)

      const invoices = rawInvoices.map((raw) => {
        const inv = convertKeysToSnakeCase(raw)
        return {
          team_id: teamId,
          client_name: (inv.client_name as string) || '',
          project_name: (inv.project_name as string) || null,
          amount: (inv.amount as number) || 0,
          status: (inv.status as string) || 'projected',
          projected_date: (inv.projected_date as string) || null,
          actual_received_date: (inv.actual_received_date as string) || null,
          month: (inv.month as string) || null,
        }
      })

      const { error } = await supabase.from('invoices').insert(invoices)
      if (error) throw new Error(`Failed to import invoices: ${error.message}`)
    }
  }

  if (parsed.budgetRequests || parsed.budget_requests) {
    const rawRequests = (parsed.budgetRequests || parsed.budget_requests) as Record<string, unknown>[]

    if (Array.isArray(rawRequests) && rawRequests.length > 0) {
      await supabase
        .from('budget_requests')
        .delete()
        .eq('team_id', teamId)

      const requests = rawRequests.map((raw) => {
        const req = convertKeysToSnakeCase(raw)
        return {
          team_id: teamId,
          name: (req.name as string) || '',
          amount: (req.amount as number) || 0,
          priority_category: (req.priority_category as string) || 'P7: UpNext',
          status: (req.status as string) || 'requested',
          tags: Array.isArray(req.tags) ? req.tags : [],
          notes: (req.notes as string) || null,
        }
      })

      const { error } = await supabase.from('budget_requests').insert(requests)
      if (error) throw new Error(`Failed to import budget requests: ${error.message}`)
    }
  }

  if (parsed.budgetPeriods || parsed.budget_periods) {
    const rawPeriods = (parsed.budgetPeriods || parsed.budget_periods) as Record<string, unknown>[]

    if (Array.isArray(rawPeriods) && rawPeriods.length > 0) {
      await supabase
        .from('budget_periods')
        .delete()
        .eq('team_id', teamId)

      for (const raw of rawPeriods) {
        const period = convertKeysToSnakeCase(raw)
        const oldId = period.id as string | undefined

        const { data: newPeriod, error: periodError } = await supabase
          .from('budget_periods')
          .insert({
            team_id: teamId,
            period_name: (period.period_name as string) || '',
            income_amount: (period.income_amount as number) || 0,
            deduction_overrides: (period.deduction_overrides as Record<string, unknown>) || {},
          })
          .select()
          .single()

        if (periodError) throw new Error(`Failed to import budget period: ${periodError.message}`)

        if (oldId && (parsed.periodExpenses || parsed.period_expenses)) {
          const rawExpenses = (parsed.periodExpenses || parsed.period_expenses) as Record<string, unknown>[]
          const periodExpenses = rawExpenses.filter((e) => {
            const exp = convertKeysToSnakeCase(e)
            return exp.period_id === oldId
          })

          if (periodExpenses.length > 0) {
            const expenses = periodExpenses.map((raw, index) => {
              const exp = convertKeysToSnakeCase(raw)
              return {
                period_id: newPeriod.id,
                team_id: teamId,
                base_item_id: null,
                name: (exp.name as string) || '',
                default_amount: (exp.default_amount as number) || 0,
                due_day: (exp.due_day as number) ?? null,
                account: (exp.account as string) || null,
                priority_category: (exp.priority_category as string) || null,
                frequency: (exp.frequency as string) || 'Monthly',
                auto_pay: Boolean(exp.auto_pay),
                pay_url: (exp.pay_url as string) || null,
                notes: (exp.notes as string) || null,
                tags: Array.isArray(exp.tags) ? exp.tags : [],
                pay_now: Boolean(exp.pay_now),
                transferred: Boolean(exp.transferred),
                paid: Boolean(exp.paid),
                cleared: Boolean(exp.cleared),
                amount_override: (exp.amount_override as number) ?? null,
                override_notes: (exp.override_notes as string) || null,
                paid_amount: (exp.paid_amount as number) ?? 0,
                sort_order: (exp.sort_order as number) ?? index,
              }
            })

            const { error } = await supabase.from('period_expenses').insert(expenses)
            if (error) throw new Error(`Failed to import period expenses: ${error.message}`)
          }
        }

        if (oldId && (parsed.periodManualIncome || parsed.period_manual_income)) {
          const rawIncome = (parsed.periodManualIncome || parsed.period_manual_income) as Record<string, unknown>[]
          const periodIncome = rawIncome.filter((i) => {
            const inc = convertKeysToSnakeCase(i)
            return inc.period_id === oldId
          })

          if (periodIncome.length > 0) {
            const incomeRows = periodIncome.map((raw) => {
              const inc = convertKeysToSnakeCase(raw)
              return {
                period_id: newPeriod.id,
                team_id: teamId,
                description: (inc.description as string) || '',
                amount: (inc.amount as number) || 0,
              }
            })

            const { error } = await supabase.from('period_manual_income').insert(incomeRows)
            if (error) throw new Error(`Failed to import manual income: ${error.message}`)
          }
        }
      }
    }
  }

  if (parsed.accounts) {
    const rawAccounts = parsed.accounts as Record<string, unknown>[]

    if (Array.isArray(rawAccounts) && rawAccounts.length > 0) {
      await supabase
        .from('accounts')
        .delete()
        .eq('team_id', teamId)

      const accounts = rawAccounts.map((raw, index) => {
        const acct = convertKeysToSnakeCase(raw)
        return {
          team_id: teamId,
          name: (acct.name as string) || '',
          sort_order: (acct.sort_order as number) ?? index,
        }
      })

      const { error } = await supabase.from('accounts').insert(accounts)
      if (error) throw new Error(`Failed to import accounts: ${error.message}`)
    }
  }

  if (parsed.priorityCategories || parsed.priority_categories) {
    const rawCategories = (parsed.priorityCategories || parsed.priority_categories) as Record<string, unknown>[]

    if (Array.isArray(rawCategories) && rawCategories.length > 0) {
      await supabase
        .from('priority_categories')
        .delete()
        .eq('team_id', teamId)

      const categories = rawCategories.map((raw, index) => {
        const cat = convertKeysToSnakeCase(raw)
        return {
          team_id: teamId,
          name: (cat.name as string) || '',
          color_key: (cat.color_key as string) || 'blue',
          sort_order: (cat.sort_order as number) ?? index,
        }
      })

      const { error } = await supabase.from('priority_categories').insert(categories)
      if (error) throw new Error(`Failed to import priority categories: ${error.message}`)
    }
  }
}
