'use client'

import { useState, useTransition } from 'react'
import {
  createPriorityCategory,
  updatePriorityCategory,
  deletePriorityCategory,
  reorderPriorityCategories,
} from '@/app/actions/settings'
import type { PriorityCategoryRecord } from '@/lib/types'
import { COLOR_KEYS, COLOR_KEY_MAP } from '@/lib/utils'

interface CategoriesPanelProps {
  categories: PriorityCategoryRecord[]
}

export default function CategoriesPanel({ categories }: CategoriesPanelProps) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('blue')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleAdd = () => {
    if (!newName.trim()) return
    setError(null)
    const name = newName.trim()
    const color = newColor
    setNewName('')
    setNewColor('blue')
    startTransition(async () => {
      try {
        await createPriorityCategory(name, color)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create category')
      }
    })
  }

  const handleUpdate = (id: string) => {
    if (!editName.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        await updatePriorityCategory(id, editName.trim(), editColor)
        setEditingId(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update category')
      }
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? Existing items using this category won't be affected.`)) return
    setError(null)
    startTransition(async () => {
      try {
        await deletePriorityCategory(id)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete category')
      }
    })
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...categories]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newOrder.length) return
    ;[newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]]
    startTransition(async () => {
      try {
        await reorderPriorityCategories(newOrder.map(c => c.id))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to reorder')
      }
    })
  }

  const startEdit = (cat: PriorityCategoryRecord) => {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditColor(cat.color_key)
  }

  const inputClass = 'w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors'

  return (
    <div className="bg-bg-white rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-h3 font-bold text-text-heading">Priority Categories</h2>
        <p className="text-caption text-text-muted mt-0.5">Organize expenses by priority level with color coding</p>
      </div>

      {error && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg px-4 py-3 mb-4 text-caption text-warning font-medium">
          {error}
        </div>
      )}

      {/* Category list */}
      <div className="space-y-2 mb-4">
        {categories.map((cat, index) => (
          <div key={cat.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
            {/* Reorder buttons */}
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <button
                onClick={() => handleMove(index, 'up')}
                disabled={index === 0 || isPending}
                className="text-text-muted hover:text-text-heading disabled:opacity-20 text-xs leading-none"
                title="Move up"
              >
                ▲
              </button>
              <button
                onClick={() => handleMove(index, 'down')}
                disabled={index === categories.length - 1 || isPending}
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
                    disabled={isPending}
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
                <button
                  onClick={() => startEdit(cat)}
                  className="text-caption text-text-muted hover:text-primary font-semibold transition-colors flex-shrink-0"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(cat.id, cat.name)}
                  disabled={isPending}
                  className="text-caption text-text-muted hover:text-warning font-semibold transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        ))}

        {categories.length === 0 && (
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
            disabled={!newName.trim() || isPending}
            className="bg-primary-teal text-text-inverse rounded-full px-4 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            {isPending ? 'Adding…' : '+ Add'}
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
