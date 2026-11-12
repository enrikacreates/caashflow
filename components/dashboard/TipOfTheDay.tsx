'use client'

import { useState, useSyncExternalStore } from 'react'
import { ChevronRight } from 'lucide-react'
import { localToday } from '@/lib/sessions'
import { tipForDate } from '@/lib/tips'

const noSubscribe = () => () => {}

/**
 * Daily tip, following the viewer's clock, with a button to cycle on to the next one.
 * Reloading returns to today's tip. Placement and display come from the caller.
 */
export default function TipOfTheDay({ className = '' }: { className?: string }) {
  const today = useSyncExternalStore(noSubscribe, localToday, () => null)
  const [skip, setSkip] = useState(0)
  if (!today) return null
  const { topic, text } = tipForDate(today, skip)
  return (
    <div className={`items-center gap-2 ${className}`}>
      <p aria-live="polite" className="text-caption text-text-muted min-w-0">
        <span className="font-bold text-text-heading">
          {skip === 0 ? 'Tip of the day' : 'Tip'} ({topic.toLowerCase()}):
        </span>{' '}
        {text}
      </p>
      <button
        type="button"
        onClick={() => setSkip((s) => s + 1)}
        aria-label="Next tip"
        title="Next tip"
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-bg-white shadow-card text-text-heading hover:text-primary transition-colors"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
