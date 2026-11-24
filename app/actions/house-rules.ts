'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserTeamId } from '@/lib/supabase/helpers'
import type { HouseRule } from '@/lib/types'

const DEFAULT_RULES = ['Tithe', 'Save', 'Give', 'Pay down debt', 'Eat at home']

function cleanText(text: string): string {
  const t = text.trim().slice(0, 140)
  if (!t) throw new Error('A rule needs some words')
  return t
}

/**
 * The team's house rules, in order. The first load seeds the defaults; claiming the
 * settings flag first means two tabs loading at once can't seed twice, and deleting
 * every rule later doesn't bring the defaults back.
 */
export async function getHouseRules(): Promise<HouseRule[]> {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { data: claimed } = await supabase
    .from('settings')
    .update({ house_rules_seeded: true })
    .eq('team_id', teamId)
    .eq('house_rules_seeded', false)
    .select('id')
  if (claimed?.length) {
    await supabase
      .from('house_rules')
      .insert(DEFAULT_RULES.map((text, i) => ({ team_id: teamId, text, sort_order: i })))
  }

  const { data, error } = await supabase
    .from('house_rules')
    .select('*')
    .eq('team_id', teamId)
    .order('sort_order')
    .order('created_at')
  if (error) throw new Error(`Failed to load house rules: ${error.message}`)
  return data ?? []
}

export async function addHouseRule(text: string): Promise<HouseRule> {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { data: last } = await supabase
    .from('house_rules')
    .select('sort_order')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('house_rules')
    .insert({ team_id: teamId, text: cleanText(text), sort_order: (last?.sort_order ?? -1) + 1 })
    .select('*')
    .single()
  if (error) throw new Error(`Failed to add rule: ${error.message}`)
  return data
}

export async function updateHouseRule(id: string, text: string) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { error } = await supabase
    .from('house_rules')
    .update({ text: cleanText(text), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('team_id', teamId)
  if (error) throw new Error(`Failed to update rule: ${error.message}`)
}

export async function removeHouseRule(id: string) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const { error } = await supabase.from('house_rules').delete().eq('id', id).eq('team_id', teamId)
  if (error) throw new Error(`Failed to remove rule: ${error.message}`)
}

/** Save a new order: `ids` top to bottom. */
export async function reorderHouseRules(ids: string[]) {
  const supabase = await createClient()
  const teamId = await getUserTeamId()

  const now = new Date().toISOString()
  const results = await Promise.all(
    ids.map((id, i) =>
      supabase.from('house_rules').update({ sort_order: i, updated_at: now }).eq('id', id).eq('team_id', teamId)
    )
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) throw new Error(`Failed to reorder rules: ${failed.error.message}`)
}
