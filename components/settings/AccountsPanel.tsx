'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { createAccount, updateAccount, deleteAccount, reorderAccounts } from '@/app/actions/settings'
import { notifyError } from '@/lib/toast'
import type { Account } from '@/lib/types'

interface AccountsPanelProps {
  accounts: Account[]
}

type AccountOptUpdate =
  | { kind: 'add'; row: Account }
  | { kind: 'remove'; id: string }
  | { kind: 'patch'; id: string; name: string }
  | { kind: 'reorder'; ids: string[] }

const isTemp = (id: string) => id.startsWith('tmp-')

export default function AccountsPanel({ accounts }: AccountsPanelProps) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [, startTransition] = useTransition()

  // Optimistic mirror: adds, renames, deletes and reorders show instantly;
  // revalidatePath in the actions brings back the real rows.
  const [optAccounts, applyOpt] = useOptimistic(
    accounts,
    (state: Account[], u: AccountOptUpdate) => {
      if (u.kind === 'add') return [...state, u.row]
      if (u.kind === 'remove') return state.filter((a) => a.id !== u.id)
      if (u.kind === 'patch') return state.map((a) => (a.id === u.id ? { ...a, name: u.name } : a))
      const byId = new Map(state.map((a) => [a.id, a]))
      return u.ids.map((id) => byId.get(id)).filter((a): a is Account => !!a)
    }
  )

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) return // also guards double-submit: the input is cleared below
    setNewName('')
    const now = new Date().toISOString()
    const ghost: Account = {
      id: `tmp-${Date.now()}`,
      team_id: '',
      name,
      sort_order: optAccounts.length,
      created_at: now,
      updated_at: now,
    }
    startTransition(async () => {
      applyOpt({ kind: 'add', row: ghost })
      try { await createAccount(name) }
      catch { notifyError('Could not add account. Please try again.') }
    })
  }

  const handleUpdate = (id: string) => {
    const name = editName.trim()
    if (!name) return
    setEditingId(null)
    startTransition(async () => {
      applyOpt({ kind: 'patch', id, name })
      try { await updateAccount(id, name) }
      catch { notifyError('Could not rename account. Please try again.') }
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete account "${name}"? Existing items using this account won't be affected.`)) return
    startTransition(async () => {
      applyOpt({ kind: 'remove', id })
      try { await deleteAccount(id) }
      catch { notifyError('Could not delete account. Please try again.') }
    })
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...optAccounts]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newOrder.length) return
    ;[newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]]
    const ids = newOrder.map((a) => a.id)
    startTransition(async () => {
      applyOpt({ kind: 'reorder', ids })
      // Unsaved rows have no server id yet, so leave them out of the payload.
      try { await reorderAccounts(ids.filter((id) => !isTemp(id))) }
      catch { notifyError('Could not reorder accounts. Please try again.') }
    })
  }

  const startEdit = (account: Account) => {
    setEditingId(account.id)
    setEditName(account.name)
  }

  const inputClass = 'w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors'

  return (
    <div className="bg-bg-white rounded-lg shadow-card p-6">
      <div className="mb-6">
        <h2 className="text-h3 font-bold text-text-heading">Accounts</h2>
        <p className="text-caption text-text-muted mt-0.5">Bank accounts / payment sources for your expenses</p>
      </div>

      {/* Account list */}
      <div className="space-y-2 mb-4">
        {optAccounts.map((account, index) => {
          const temp = isTemp(account.id)
          return (
            <div key={account.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
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
                  disabled={index === optAccounts.length - 1 || temp}
                  className="text-text-muted hover:text-text-heading disabled:opacity-20 text-xs leading-none"
                  title="Move down"
                >
                  ▼
                </button>
              </div>

              {/* Name (editable) */}
              {editingId === account.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(account.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className={inputClass}
                    autoFocus
                  />
                  <button
                    onClick={() => handleUpdate(account.id)}
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
              ) : temp ? (
                <>
                  <span className="flex-1 text-caption font-medium text-text-heading">{account.name}</span>
                  <span className="text-caption text-text-muted italic flex-shrink-0">Saving…</span>
                </>
              ) : (
                <>
                  <span
                    onClick={() => startEdit(account)}
                    className="flex-1 text-caption font-medium text-text-heading cursor-pointer hover:text-primary transition-colors"
                    title="Click to edit"
                  >
                    {account.name}
                  </span>
                  <button
                    onClick={() => handleDelete(account.id, account.name)}
                    className="text-caption text-text-muted hover:text-warning font-semibold transition-colors flex-shrink-0 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          )
        })}

        {optAccounts.length === 0 && (
          <div className="text-center py-6 text-text-muted text-caption">
            No accounts yet. Add one below.
          </div>
        )}
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="New account name..."
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
    </div>
  )
}
