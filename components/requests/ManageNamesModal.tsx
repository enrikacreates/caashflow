'use client'

import { useState, useTransition } from 'react'
import { renameRequestedFor, renameRequestTag } from '@/app/actions/requests'

function RenameRow({
  value, onSave, onRemove, isPending,
}: { value: string; onSave: (to: string) => void; onRemove: () => void; isPending: boolean }) {
  const [val, setVal] = useState(value)
  const dirty = val.trim() !== value && val.trim() !== ''
  return (
    <div className="flex items-center gap-2">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="flex-1 bg-bg-white border border-border rounded-sm px-3 py-1.5 text-caption focus:outline-none focus:border-primary transition-colors"
      />
      <button
        onClick={() => onSave(val)}
        disabled={!dirty || isPending}
        className="shrink-0 text-caption text-primary font-semibold hover:underline disabled:opacity-40"
      >
        Save
      </button>
      <button
        onClick={onRemove}
        disabled={isPending}
        title="Remove from all requests"
        className="shrink-0 text-caption text-text-muted hover:text-warning font-semibold transition-colors disabled:opacity-40"
      >
        ✕
      </button>
    </div>
  )
}

export default function ManageNamesModal({
  people, tags, onClose,
}: { people: string[]; tags: string[]; onClose: () => void }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-white rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[36px] leading-tight font-bold text-text-heading">Manage Who/What & Tags</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-heading text-xl transition-colors">✕</button>
        </div>
        <p className="text-caption text-text-muted mb-5">Rename fixes typos across every request at once; ✕ removes the value from all.</p>

        <div className="mb-6">
          <h3 className="text-caption font-bold uppercase text-text-muted mb-2">Who / What</h3>
          {people.length === 0 ? (
            <p className="text-caption text-text-muted italic">No names used yet.</p>
          ) : (
            <div className="space-y-2">
              {people.map((p) => (
                <RenameRow
                  key={p}
                  value={p}
                  isPending={isPending}
                  onSave={(to) => startTransition(() => renameRequestedFor(p, to))}
                  onRemove={() => startTransition(() => renameRequestedFor(p, ''))}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-caption font-bold uppercase text-text-muted mb-2">Tags</h3>
          {tags.length === 0 ? (
            <p className="text-caption text-text-muted italic">No tags used yet.</p>
          ) : (
            <div className="space-y-2">
              {tags.map((t) => (
                <RenameRow
                  key={t}
                  value={t}
                  isPending={isPending}
                  onSave={(to) => startTransition(() => renameRequestTag(t, to))}
                  onRemove={() => startTransition(() => renameRequestTag(t, ''))}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
