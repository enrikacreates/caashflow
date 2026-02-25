'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserHouseholdId } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'

export async function getSettings() {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('household_id', householdId)
    .limit(1)
    .single()

  if (error) throw new Error(`Failed to fetch settings: ${error.message}`)
  return data
}

export async function updateSettings(formData: FormData) {
  const supabase = await createClient()
  const householdId = await getUserHouseholdId()

  const updates = {
    tithe_percentage: parseFloat(formData.get('tithe_percentage') as string) || 0,
    savings_percentage: parseFloat(formData.get('savings_percentage') as string) || 0,
    tax_percentage: parseFloat(formData.get('tax_percentage') as string) || 0,
    profit_percentage: parseFloat(formData.get('profit_percentage') as string) || 0,
    fun_money_percentage: parseFloat(formData.get('fun_money_percentage') as string) || 0,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('settings')
    .update(updates)
    .eq('household_id', householdId)

  if (error) throw new Error(`Failed to update settings: ${error.message}`)

  revalidatePath('/settings')
}
