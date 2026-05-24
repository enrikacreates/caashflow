'use client'

import { useState, useTransition } from 'react'
import { submitPublicRequest, uploadPublicRequestImage } from '@/app/actions/requests'

export default function PublicRequestForm({ slug }: { slug: string }) {
  const [isPending, startTransition] = useTransition()
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const inputClass = 'w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors'

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    setUploading(true)
    startTransition(async () => {
      try {
        setImageUrl(await uploadPublicRequestImage(fd))
      } catch {
        setError('Image upload failed — you can paste a link instead.')
      } finally {
        setUploading(false)
      }
    })
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await submitPublicRequest(fd)
        setDone(true)
      } catch {
        setError('Something went wrong — please try again.')
      }
    })
  }

  if (done) {
    return (
      <div className="bg-bg-white rounded-lg shadow-card p-8 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <h2 className="text-h3 font-bold text-text-heading mb-1">Request sent!</h2>
        <p className="text-caption text-text-muted mb-5">It’s on the family’s list.</p>
        <button
          onClick={() => { setImageUrl(''); setDone(false) }}
          className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-bold hover:opacity-90 transition-opacity"
        >
          Add another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-bg-white rounded-lg shadow-card p-6 space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="image_url" value={imageUrl} />

      <div>
        <label className="block text-caption font-semibold text-text-heading mb-1">What do you want? *</label>
        <input type="text" name="name" required placeholder="e.g. Lego Star Wars set" className={inputClass} />
      </div>
      <div>
        <label className="block text-caption font-semibold text-text-heading mb-1">Who's it for?</label>
        <input type="text" name="requested_for" placeholder="Your name" className={inputClass} />
      </div>
      <div>
        <label className="block text-caption font-semibold text-text-heading mb-1">About how much?</label>
        <input type="number" name="amount" step="0.01" placeholder="0.00" className={inputClass} />
      </div>
      <div>
        <label className="block text-caption font-semibold text-text-heading mb-1">Link</label>
        <input type="url" name="url" placeholder="Where to buy it (optional)" className={inputClass} />
      </div>
      <div>
        <label className="block text-caption font-semibold text-text-heading mb-1">Photo</label>
        {imageUrl && <img src={imageUrl} alt="" className="w-full max-h-44 object-cover rounded-sm mb-2 border border-border" />}
        <input type="url" placeholder="Paste an image link" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputClass} />
        <div className="text-caption text-text-muted text-center my-1.5">or</div>
        <label className="inline-block bg-bg-white text-text-heading border border-border rounded-full px-4 py-1.5 text-caption font-semibold hover:border-primary transition-colors cursor-pointer">
          {uploading ? 'Uploading…' : '📷 Take / upload a photo'}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      </div>
      <div>
        <label className="block text-caption font-semibold text-text-heading mb-1">Note</label>
        <textarea name="notes" rows={2} placeholder="Anything else?" className={inputClass + ' resize-y'} />
      </div>

      {error && <p className="text-caption text-warning">{error}</p>}

      <button
        type="submit"
        disabled={isPending || uploading}
        className="w-full bg-primary-teal text-text-inverse rounded-full px-5 py-3 text-label font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {isPending ? 'Sending…' : 'Send request'}
      </button>
    </form>
  )
}
