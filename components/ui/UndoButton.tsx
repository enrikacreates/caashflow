'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Undo2 } from 'lucide-react'
import { clearUndo, subscribeUndo, undoLast, type UndoEntry } from '@/lib/toast'

/**
 * Corner Undo: steps back through recent actions on this page (Pay, Funded, Clear, split).
 * Mirrors the home mark in the opposite corner and only shows when there's something to undo.
 */
export default function UndoButton() {
  const [stack, setStack] = useState<UndoEntry[]>([])
  const pathname = usePathname()

  useEffect(() => subscribeUndo(setStack), [])
  // The history belongs to the page that made it
  useEffect(() => { clearUndo() }, [pathname])

  const last = stack[stack.length - 1]
  if (!last) return null

  return (
    <button
      type="button"
      onClick={undoLast}
      aria-label={`Undo: ${last.message}`}
      title={`Undo: ${last.message}${stack.length > 1 ? ` (${stack.length} steps)` : ''}`}
      className="chrome-undo fixed right-16 md:right-6 z-30 h-10 pl-3 pr-3.5 inline-flex items-center gap-1.5 rounded-full bg-white shadow-card text-caption font-semibold text-text-heading hover:text-primary transition-colors"
    >
      <Undo2 size={16} aria-hidden="true" />
      Undo
      {stack.length > 1 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-surface-beige text-[10px] font-bold leading-[18px] text-center">{stack.length}</span>
      )}
    </button>
  )
}
