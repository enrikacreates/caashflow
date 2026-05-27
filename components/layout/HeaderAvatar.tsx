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
    <Link href="/settings" className="relative w-14 h-14 md:w-16 md:h-16 ml-1 block group" aria-label="Profile & settings">
      {/* Green organic blob — backdrop, sized larger and shifted up-left so the green peeks out on the top-left of the photo */}
      <img
        src="/shapes/profile-blob-green.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute -top-5 -left-6 w-[155%] h-[155%] max-w-none -rotate-[28deg] transition-transform duration-200 group-hover:-rotate-[16deg] group-hover:scale-105"
      />
      {/* Profile image — circular container with a white ring */}
      <div className="relative w-full h-full rounded-full bg-surface-beige ring-2 ring-white shadow-sm flex items-center justify-center overflow-hidden">
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
