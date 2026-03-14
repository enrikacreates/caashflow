import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('display_name, avatar_url')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    display_name: profile?.display_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    email: user.email ?? null,
  })
}
