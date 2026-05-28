'use client'

import { useState, useTransition } from 'react'
import { createBudgetRequest, updateBudgetRequest, uploadRequestImage } from '@/app/actions/requests'
import type { BudgetRequest, PriorityCategoryRecord } from '@/lib/types'
import Combobox from './Combobox'

const DEFAULT_TAGS = ['Christmas Wishlist', 'B-Day GiftWish', 'One-day', 'Gift Idea', 'Back to School']

export default function RequestFormModal({
  editItem, onClose, categories, forWhoOptions, tagOptions,
}: { editItem: BudgetRequest | null; onClose: () => void; categories: PriorityCategoryRecord[]; forWhoOptions: string[]; tagOptions: string[] }) {
  const [isPending, startTransition] = useTransition()
  const [imageUrl, setImageUrl] = useState(editItem?.image_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [tags, setTags] = useState<string[]>(editItem?.tags ?? [])
  const [newTag, setNewTag] = useState('')
  const inputClass = 'w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors'

  const allTags = [...new Set([...DEFAULT_TAGS, ...tagOptions, ...tags])]
  const toggleTag = (t: string) => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))
  const addNewTag = () => {
    const t = newTag.trim()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setNewTag('')
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    setUploading(true)
    startTransition(async () => {
      try {
        const url = await uploadRequestImage(fd)
        setImageUrl(url)
      } finally {
        setUploading(false)
      }
    })
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      if (editItem) await updateBudgetRequest(formData)
      else await createBudgetRequest(formData)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-white rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[36px] leading-tight font-bold text-text-heading">{editItem ? 'Edit Next Buy' : 'Add to List'}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-heading text-xl transition-colors">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {editItem && <input type="hidden" name="id" value={editItem.id} />}
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Name *</label>
            <input type="text" name="name" required defaultValue={editItem?.name || ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">For (who or what)</label>
            <Combobox name="requested_for" defaultValue={editItem?.requested_for || ''} options={forWhoOptions} placeholder="Who or what is this for? (e.g. Daughter, Home, Guests)" className={inputClass} />
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Amount</label>
            <input type="number" name="amount" step="0.01" defaultValue={editItem?.amount || ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Link</label>
            <input type="url" name="url" placeholder="Where to buy it (optional)" defaultValue={editItem?.url || ''} className={inputClass} />
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Image</label>
            {imageUrl && (
              <img src={imageUrl} alt="" className="w-full max-h-44 object-cover rounded-sm mb-2 border border-border" />
            )}
            <input type="url" placeholder="Paste an image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputClass} />
            <div className="text-caption text-text-muted text-center my-1.5">or</div>
            <div className="flex items-center gap-2">
              <label className="bg-bg-white text-text-heading border border-border rounded-full px-4 py-1.5 text-caption font-semibold hover:border-primary transition-colors cursor-pointer">
                {uploading ? 'Uploading…' : '📷 Upload / Camera'}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} disabled={uploading} />
              </label>
              {imageUrl && (
                <button type="button" onClick={() => setImageUrl('')} className="text-caption text-text-muted hover:text-warning font-semibold transition-colors">
                  Remove
                </button>
              )}
            </div>
            <input type="hidden" name="image_url" value={imageUrl} />
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Priority</label>
            <select name="priority_category" defaultValue={editItem?.priority_category || (categories[0]?.name ?? '')} className={inputClass}>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Status</label>
            <select name="status" defaultValue={editItem?.status || 'requested'} className={inputClass}>
              <option value="requested">Requested</option>
              <option value="approved">Approved</option>
              <option value="purchased">Purchased</option>
              <option value="obtained">Got it</option>
            </select>
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Tags <span className="font-normal text-text-muted">(tap to select)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((t) => {
                const on = tags.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={`px-2.5 py-1 rounded-full text-caption font-semibold transition-colors ${on ? 'bg-primary-teal text-text-inverse' : 'bg-surface-beige text-text-muted hover:text-text-heading'}`}
                  >
                    {on ? '✓ ' : ''}{t}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewTag() } }}
                placeholder="+ add a tag"
                className={inputClass}
              />
              <button type="button" onClick={addNewTag} className="shrink-0 bg-bg-white text-text-heading border border-border rounded-full px-4 text-caption font-semibold hover:border-primary transition-colors">Add</button>
            </div>
            <input type="hidden" name="tags" value={tags.join(', ')} />
          </div>
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Notes</label>
            <textarea name="notes" rows={2} defaultValue={editItem?.notes || ''} className={inputClass + ' resize-y'} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-bg-white text-text-heading border border-border rounded-full px-5 py-2.5 text-caption font-semibold hover:border-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
