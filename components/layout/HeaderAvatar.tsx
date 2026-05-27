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
    <Link href="/settings" className="relative w-12 h-12 md:w-14 md:h-14 ml-1 block group" aria-label="Profile & settings">
      {/* Green organic blob — backdrop at its natural orientation, centered behind the photo (matches the mockup) */}
      <img
        src="/shapes/profile-blob-green.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[148%] h-[132%] max-w-none transition-transform duration-200 group-hover:scale-105"
      />
      {/* Profile image — circular container with a white ring */}
      <div className="relative w-full h-full rounded-full bg-surface-beige flex items-center justify-center overflow-hidden">
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
