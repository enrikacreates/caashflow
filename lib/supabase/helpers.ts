import { cache } from 'react'
import { createClient } from './server'

// Memoized per request (React cache): a page render or server action touches
// many data functions, and each used to re-verify the user with Supabase Auth
// and re-query the team — ~5 round trips per render collapse to one.
export const getUserTeamId = cache(async (): Promise<string> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Query public.team_members (switch schema for this one query)
  const { data, error } = await supabase.schema('public')
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (data) return data.team_id

  // Lazy-provision on first visit (shared-auth on theDailyStory means
  // the user may exist in auth.users without a caashflow team yet).
  const { data: provisioned, error: provisionError } = await supabase
    .rpc('provision_team_for_current_user')

  if (provisionError || !provisioned) throw provisionError ?? new Error('Failed to provision team')
  return provisioned as string
})

export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
