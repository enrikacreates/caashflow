'use client'

import { useState, useEffect, useTransition } from 'react'
import { setFamilyName } from '@/app/actions/requests'

export default function FamilyShareCard({ name, slug }: { name: string; slug: string | null }) {
  const [isPending, startTransition] = useTransition()
  const [val, setVal] = useState(name && name !== 'My Household' ? name : '')
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { setOrigin(window.location.origin) }, [])

  const link = slug ? `${origin}/request/${slug}` : ''

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData()
    fd.append('name', val)
    startTransition(() => setFamilyName(fd))
  }

  const copy = () => {
    if (!link) return
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const inputClass = 'w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors'

  return (
    <div className="bg-bg-white rounded-lg shadow-card p-6">
      <h2 className="text-h3 font-bold text-text-heading mb-1">Family & Request Link</h2>
      <p className="text-caption text-text-muted mb-4">
        Set your family name to get a shareable link. Anyone with it can add to your Next Buys list — no account needed.
      </p>

      <form onSubmit={save} className="flex gap-2 items-end mb-4">
        <div className="flex-1">
          <label className="block text-caption font-semibold text-text-heading mb-1">Family name</label>
          <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. Noonan" className={inputClass} />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </form>

      {slug ? (
        <div className="flex items-center gap-2 bg-surface-beige rounded-sm px-3 py-2">
          <span className="text-caption text-text-muted truncate flex-1">{link || `/request/${slug}`}</span>
          <button onClick={copy} className="shrink-0 text-caption text-primary font-semibold hover:underline">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      ) : (
        <p className="text-caption text-text-muted">Save a family name to generate your shareable link.</p>
      )}
    </div>
  )
}
