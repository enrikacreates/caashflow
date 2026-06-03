'use client'

import { useEffect, useState } from 'react'
import { subscribeToasts, type Toast } from '@/lib/toast'

/**
 * Renders the toast stack in the bottom-right of the viewport. Mount once,
 * near the root (dashboard layout). All toasts are short-lived (2.5–3.5s)
 * and auto-dismiss via the toast module's timer.
 */
export default function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => subscribeToasts(setToasts), [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-28 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-lg shadow-card px-4 py-2.5 text-caption font-semibold animate-in fade-in slide-in-from-bottom-2 ${
            t.kind === 'error'
              ? 'bg-warning/95 text-white'
              : 'bg-text-heading/95 text-white'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
