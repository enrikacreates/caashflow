'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/* -------------------------------------------------------
 * HEADER AVATAR
 *
 * Fetches profile data client-side via API route,
 * shows avatar or initials with colored blob background.
 * Clicking navigates to settings (profile section).
 * ------------------------------------------------------- */
export default function HeaderAvatar() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [initials, setInitials] = useState('?')

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        if (data.avatar_url) setAvatarUrl(data.avatar_url)
        if (data.display_name) {
          const parts = data.display_name.split(' ')
          setInitials(parts.map((w: string) => w[0]).join('').toUpperCase().slice(0, 2))
        } else if (data.email) {
          setInitials(data.email.charAt(0).toUpperCase())
        }
      })
      .catch(() => {})
  }, [])

  return (
    <Link href="/settings" className="relative w-12 h-12 md:w-14 md:h-14 ml-1 block group">
      {/* Colored organic blob */}
      <div
        className="absolute inset-0 rounded-full transition-transform group-hover:scale-110"
        style={{
          background: 'linear-gradient(135deg, #b7f0f4 0%, #ffd34f 50%, #ffcbcd 100%)',
          transform: 'rotate(-12deg) scale(1.15)',
        }}
      />
      {/* Avatar circle */}
      <div className="relative w-full h-full rounded-full bg-surface-beige border-2 border-white flex items-center justify-center overflow-hidden">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-text-muted font-bold text-sm">{initials}</span>
        )}
      </div>
    </Link>
  )
}
