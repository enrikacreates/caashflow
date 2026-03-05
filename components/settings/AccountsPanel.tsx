'use client'

import { useState, useTransition } from 'react'
import { createAccount, updateAccount, deleteAccount, reorderAccounts } from '@/app/actions/settings'
import type { Account } from '@/lib/types'

interface AccountsPanelProps {
  accounts: Account[]
}

export default function AccountsPanel({ accounts }: AccountsPanelProps) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleAdd = () => {
    if (!newName.trim()) return
    setError(null)
    const name = newName.trim()
    setNewName('')
    startTransition(async () => {
      try {
        await createAccount(name)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create account')
      }
    })
  }

  const handleUpdate = (id: string) => {
    if (!editName.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        await updateAccount(id, editName.trim())
        setEditingId(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update account')
      }
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete account "${name}"? Existing items using this account won't be affected.`)) return
    setError(null)
    startTransition(async () => {
      try {
        await deleteAccount(id)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete account')
      }
    })
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...accounts]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newOrder.length) return
    ;[newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]]
    startTransition(async () => {
      try {
        await reorderAccounts(newOrder.map(a => a.id))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to reorder')
      }
    })
  }

  const startEdit = (account: Account) => {
    setEditingId(account.id)
    setEditName(account.name)
  }

  const inputClass = 'w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors'

  return (
    <div className="bg-bg-white rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-h3 font-bold text-text-heading">Accounts</h2>
        <p className="text-caption text-text-muted mt-0.5">Bank accounts / payment sources for your expenses</p>
      </div>

      {error && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg px-4 py-3 mb-4 text-caption text-warning font-medium">
          {error}
        </div>
      )}

      {/* Account list */}
      <div className="space-y-2 mb-4">
        {accounts.map((account, index) => (
          <div key={account.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
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
                disabled={index === accounts.length - 1 || isPending}
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
                  disabled={isPending}
                  className="text-caption text-text-muted hover:text-warning font-semibold transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        ))}

        {accounts.length === 0 && (
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
          disabled={!newName.trim() || isPending}
          className="bg-primary-teal text-text-inverse rounded-full px-4 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
        >
          {isPending ? 'Adding…' : '+ Add'}
        </button>
      </div>
    </div>
  )
}
