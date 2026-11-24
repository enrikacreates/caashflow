'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, GripVertical, Pencil, Plus, X } from 'lucide-react'
import { addHouseRule, getHouseRules, removeHouseRule, reorderHouseRules, updateHouseRule } from '@/app/actions/house-rules'
import { notifyError } from '@/lib/toast'
import type { HouseRule } from '@/lib/types'

/**
 * The family's house rules: a short numbered list under the menu. Drag the dots to
 * reorder; Edit to reword, remove or add. Changes show at once and save behind.
 */
export default function HouseRules({ className = '' }: { className?: string }) {
  const [rules, setRules] = useState<HouseRule[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  // Order when the drag started, so the save only happens when something moved
  const dragStart = useRef<string[]>([])

  useEffect(() => {
    let live = true
    getHouseRules()
      .then((r) => { if (live) setRules(r) })
      .catch(() => { if (live) setRules([]) })
    return () => { live = false }
  }, [])

  if (!rules) return null

  const save = async (work: () => Promise<unknown>, undo: HouseRule[]) => {
    try { await work() }
    catch {
      setRules(undo)
      notifyError('Could not save that rule. Please try again.')
    }
  }

  const rename = (rule: HouseRule, text: string) => {
    const t = text.trim()
    if (!t || t === rule.text) return
    const before = rules
    setRules(rules.map((r) => (r.id === rule.id ? { ...r, text: t } : r)))
    save(() => updateHouseRule(rule.id, t), before)
  }

  const remove = (rule: HouseRule) => {
    const before = rules
    setRules(rules.filter((r) => r.id !== rule.id))
    save(() => removeHouseRule(rule.id), before)
  }

  const add = async () => {
    const t = draft.trim()
    if (!t) return
    const before = rules
    const tmp: HouseRule = { id: `tmp-${Date.now()}`, team_id: '', text: t, sort_order: rules.length, created_at: '', updated_at: '' }
    setRules([...rules, tmp])
    setDraft('')
    try {
      const saved = await addHouseRule(t)
      setRules((rs) => (rs ?? []).map((r) => (r.id === tmp.id ? saved : r)))
    } catch {
      setRules(before)
      notifyError('Could not add that rule. Please try again.')
    }
  }

  // Pointer-based drag so it works with a mouse and a finger alike
  const onGripDown = (e: React.PointerEvent, id: string) => {
    if (id.startsWith('tmp-')) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = rules.map((r) => r.id)
    setDragId(id)
  }

  const onGripMove = (e: React.PointerEvent) => {
    if (!dragId || !listRef.current) return
    const items = [...listRef.current.querySelectorAll<HTMLElement>('[data-rule-id]')]
    const over = items.findIndex((el) => {
      const box = el.getBoundingClientRect()
      return e.clientY < box.top + box.height / 2
    })
    // Insertion point in the current list; past the last midpoint means the very end
    const target = over === -1 ? items.length : over
    setRules((rs) => {
      if (!rs) return rs
      const from = rs.findIndex((r) => r.id === dragId)
      const to = target > from ? target - 1 : target
      if (from === -1 || from === to) return rs
      const next = [...rs]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const onGripUp = () => {
    if (!dragId) return
    setDragId(null)
    const ids = rules.map((r) => r.id)
    if (ids.join() === dragStart.current.join()) return
    const before = dragStart.current.map((id) => rules.find((r) => r.id === id)!).filter(Boolean)
    save(() => reorderHouseRules(ids), before)
  }

  return (
    <section aria-label="House rules" className={className}>
      <div className="flex items-center justify-between px-4 mb-1.5">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-text-muted">House rules</h2>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-label={editing ? 'Done editing rules' : 'Edit rules'}
          title={editing ? 'Done' : 'Edit rules'}
          className="w-7 h-7 -mr-1 inline-flex items-center justify-center rounded-full text-text-muted/60 hover:text-text-heading hover:bg-surface-beige/50 transition-colors"
        >
          {editing ? <Check size={15} aria-hidden="true" /> : <Pencil size={13} aria-hidden="true" />}
        </button>
      </div>

      <ol ref={listRef} className="space-y-0.5">
        {rules.map((rule, i) => (
          <li
            key={rule.id}
            data-rule-id={rule.id}
            className={`group flex items-center gap-1 pl-1 pr-2 py-1 rounded-2xl transition-colors ${dragId === rule.id ? 'bg-surface-beige' : ''}`}
          >
            <button
              type="button"
              aria-label={`Drag to reorder ${rule.text}`}
              title="Drag to reorder"
              onPointerDown={(e) => onGripDown(e, rule.id)}
              onPointerMove={onGripMove}
              onPointerUp={onGripUp}
              onPointerCancel={onGripUp}
              className="touch-none shrink-0 w-6 h-7 inline-flex items-center justify-center text-text-muted/40 hover:text-text-heading cursor-grab active:cursor-grabbing"
            >
              <GripVertical size={14} aria-hidden="true" />
            </button>
            <span className="shrink-0 w-4 text-caption font-bold text-text-muted tabular-nums">{i + 1}.</span>
            {editing ? (
              <>
                <input
                  defaultValue={rule.text}
                  aria-label={`Rule ${i + 1}`}
                  maxLength={140}
                  onBlur={(e) => rename(rule, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  className="min-w-0 flex-1 bg-bg-white border border-border rounded-sm px-2 py-1 text-caption focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => remove(rule)}
                  aria-label={`Remove ${rule.text}`}
                  className="shrink-0 w-6 h-6 inline-flex items-center justify-center rounded-full text-text-muted/60 hover:text-warning transition-colors"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </>
            ) : (
              <span className="min-w-0 text-caption font-semibold text-text-heading break-words">{rule.text}</span>
            )}
          </li>
        ))}
      </ol>

      {(editing || rules.length === 0) && (
        <form
          onSubmit={(e) => { e.preventDefault(); add() }}
          className="flex items-center gap-1 px-2 mt-1.5"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a rule"
            aria-label="New rule"
            maxLength={140}
            className="min-w-0 flex-1 bg-bg-white border border-border rounded-sm px-2 py-1 text-caption focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            aria-label="Add rule"
            disabled={!draft.trim()}
            className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-full bg-primary-teal text-white disabled:opacity-40 transition-opacity"
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </form>
      )}
    </section>
  )
}
