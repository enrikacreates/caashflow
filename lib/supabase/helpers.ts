import { createClient } from './server'

export async function getUserHouseholdId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (data) return data.household_id

  // Lazy-provision on first visit (shared-auth on theDailyStory means
  // the user may exist in auth.users without a caashflow household yet).
  const { data: provisioned, error: provisionError } = await supabase
    .rpc('provision_household_for_current_user')

  if (provisionError || !provisioned) throw provisionError ?? new Error('Failed to provision household')
  return provisioned as string
}

export async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
