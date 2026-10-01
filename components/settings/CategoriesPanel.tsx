'use client'

import { useOptimistic, useState, useTransition } from 'react'
import {
  createPriorityCategory,
  updatePriorityCategory,
  deletePriorityCategory,
  reorderPriorityCategories,
} from '@/app/actions/settings'
import { notifyError } from '@/lib/toast'
import type { PriorityCategoryRecord } from '@/lib/types'
import { COLOR_KEYS, COLOR_KEY_MAP } from '@/lib/utils'

interface CategoriesPanelProps {
  categories: PriorityCategoryRecord[]
}

type CategoryOptUpdate =
  | { kind: 'add'; row: PriorityCategoryRecord }
  | { kind: 'remove'; id: string }
  | { kind: 'patch'; id: string; name: string; color_key: string }
  | { kind: 'reorder'; ids: string[] }

const isTemp = (id: string) => id.startsWith('tmp-')

export default function CategoriesPanel({ categories }: CategoriesPanelProps) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('blue')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [, startTransition] = useTransition()

  // Optimistic mirror: adds, edits, deletes and reorders show instantly;
  // revalidatePath in the actions brings back the real rows.
  const [optCategories, applyOpt] = useOptimistic(
    categories,
    (state: PriorityCategoryRecord[], u: CategoryOptUpdate) => {
      if (u.kind === 'add') return [...state, u.row]
      if (u.kind === 'remove') return state.filter((c) => c.id !== u.id)
      if (u.kind === 'patch') return state.map((c) => (c.id === u.id ? { ...c, name: u.name, color_key: u.color_key } : c))
      const byId = new Map(state.map((c) => [c.id, c]))
      return u.ids.map((id) => byId.get(id)).filter((c): c is PriorityCategoryRecord => !!c)
    }
  )

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) return // also guards double-submit: the input is cleared below
    const color = newColor
    setNewName('')
    setNewColor('blue')
    const now = new Date().toISOString()
    const ghost: PriorityCategoryRecord = {
      id: `tmp-${Date.now()}`,
      team_id: '',
      name,
      color_key: color,
      sort_order: optCategories.length,
      created_at: now,
      updated_at: now,
    }
    startTransition(async () => {
      applyOpt({ kind: 'add', row: ghost })
      try { await createPriorityCategory(name, color) }
      catch { notifyError('Could not add category. Please try again.') }
    })
  }

  const handleUpdate = (id: string) => {
    const name = editName.trim()
    if (!name) return
    const color = editColor
    setEditingId(null)
    startTransition(async () => {
      applyOpt({ kind: 'patch', id, name, color_key: color })
      try { await updatePriorityCategory(id, name, color) }
      catch { notifyError('Could not update category. Please try again.') }
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? Existing items using this category won't be affected.`)) return
    startTransition(async () => {
      applyOpt({ kind: 'remove', id })
      try { await deletePriorityCategory(id) }
      catch { notifyError('Could not delete category. Please try again.') }
    })
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...optCategories]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newOrder.length) return
    ;[newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]]
    const ids = newOrder.map((c) => c.id)
    startTransition(async () => {
      applyOpt({ kind: 'reorder', ids })
      // Unsaved rows have no server id yet, so leave them out of the payload.
      try { await reorderPriorityCategories(ids.filter((id) => !isTemp(id))) }
      catch { notifyError('Could not reorder categories. Please try again.') }
    })
  }

  const startEdit = (cat: PriorityCategoryRecord) => {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditColor(cat.color_key)
  }

  const inputClass = 'w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors'

  return (
    <div className="bg-bg-white rounded-lg shadow-card p-6">
      <div className="mb-6">
        <h2 className="text-h3 font-bold text-text-heading">Priority Categories</h2>
        <p className="text-caption text-text-muted mt-0.5">Organize expenses by priority level with color coding</p>
      </div>

      {/* Category list */}
      <div className="space-y-2 mb-4">
        {optCategories.map((cat, index) => {
          const temp = isTemp(cat.id)
          return (
            <div key={cat.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  onClick={() => handleMove(index, 'up')}
                  disabled={index === 0 || temp}
                  className="text-text-muted hover:text-text-heading disabled:opacity-20 text-xs leading-none"
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleMove(index, 'down')}
                  disabled={index === optCategories.length - 1 || temp}
                  className="text-text-muted hover:text-text-heading disabled:opacity-20 text-xs leading-none"
                  title="Move down"
                >
                  ▼
                </button>
              </div>

              {editingId === cat.id ? (
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdate(cat.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className={inputClass}
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdate(cat.id)}
                      disabled={!editName.trim()}
                      className="text-caption text-primary font-semibold hover:opacity-80 flex-shrink-0"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-caption text-text-muted font-semibold hover:text-text-heading flex-shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                  <ColorPicker selected={editColor} onChange={setEditColor} />
                </div>
              ) : (
                <>
                  {/* Color badge + name */}
                  <span className={`inline-block text-caption font-bold px-2.5 py-1 rounded-full ${COLOR_KEY_MAP[cat.color_key] || 'bg-surface-gray text-text-muted'}`}>
                    {cat.name}
                  </span>
                  <div className="flex-1" />
                  {temp ? (
                    <span className="text-caption text-text-muted italic flex-shrink-0">Saving…</span>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(cat)}
                        className="text-caption text-text-muted hover:text-primary font-semibold transition-colors flex-shrink-0"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id, cat.name)}
                        className="text-caption text-text-muted hover:text-warning font-semibold transition-colors flex-shrink-0 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )
        })}

        {optCategories.length === 0 && (
          <div className="text-center py-6 text-text-muted text-caption">
            No categories yet. Add one below.
          </div>
        )}
      </div>

      {/* Add new */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="New category name..."
            className={inputClass}
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="bg-primary-teal text-text-inverse rounded-full px-4 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            + Add
          </button>
        </div>
        <ColorPicker selected={newColor} onChange={setNewColor} />
      </div>
    </div>
  )
}

function ColorPicker({ selected, onChange }: { selected: string; onChange: (key: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-caption text-text-muted font-medium mr-1">Color:</span>
      {COLOR_KEYS.map((key) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`w-6 h-6 rounded-full border-2 transition-all ${
            COLOR_KEY_MAP[key]?.split(' ')[0] || 'bg-border'
          } ${
            selected === key
              ? 'border-text-heading scale-110'
              : 'border-transparent hover:border-border'
          }`}
          title={key}
        />
      ))}
    </div>
  )
}
