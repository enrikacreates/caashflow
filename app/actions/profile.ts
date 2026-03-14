'use server'

import { createClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/lib/types'

/* -------------------------------------------------------
 * GET PROFILE — returns current user's profile
 * ------------------------------------------------------- */
export async function getProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    // Auto-create profile if missing (for users created before migration)
    const { data: created } = await supabase
      .from('user_profiles')
      .insert({
        user_id: user.id,
        display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || null,
      })
      .select()
      .single()
    return created as UserProfile | null
  }

  return data as UserProfile
}

/* -------------------------------------------------------
 * UPDATE PROFILE — update display name
 * ------------------------------------------------------- */
export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const displayName = formData.get('display_name') as string | null

  const { error } = await supabase
    .from('user_profiles')
    .update({
      display_name: displayName?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
}

/* -------------------------------------------------------
 * UPLOAD AVATAR — upload image to storage, update profile
 * ------------------------------------------------------- */
export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const file = formData.get('avatar') as File
  if (!file || file.size === 0) throw new Error('No file provided')

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Please upload a JPG, PNG, WebP, or GIF image')
  }

  // Validate file size (2MB max)
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Image must be under 2MB')
  }

  const ext = file.name.split('.').pop() || 'jpg'
  const filePath = `${user.id}/avatar.${ext}`

  // Upload to storage (upsert to replace existing)
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true })

  if (uploadError) throw new Error(uploadError.message)

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  // Add cache-busting param
  const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`

  // Update profile
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (updateError) throw new Error(updateError.message)

  return avatarUrl
}

/* -------------------------------------------------------
 * REMOVE AVATAR — delete from storage, clear profile
 * ------------------------------------------------------- */
export async function removeAvatar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // List files in user's avatar folder
  const { data: files } = await supabase.storage
    .from('avatars')
    .list(user.id)

  // Delete all avatar files for this user
  if (files && files.length > 0) {
    const filePaths = files.map(f => `${user.id}/${f.name}`)
    await supabase.storage.from('avatars').remove(filePaths)
  }

  // Clear avatar_url in profile
  const { error } = await supabase
    .from('user_profiles')
    .update({
      avatar_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
}
