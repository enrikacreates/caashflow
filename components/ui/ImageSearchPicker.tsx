'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'
import { searchWebImages, type ImageResult } from '@/app/actions/image-search'

/**
 * Modal that lets you search the web for an image and tap one to attach it.
 *
 * Usage:
 *   <ImageSearchPicker
 *     initialQuery={item.name}
 *     onPick={(url) => setImageUrl(url)}
 *     onClose={() => setPickerOpen(false)}
 *   />
 */
export default function ImageSearchPicker({
  initialQuery = '',
  onPick,
  onClose,
}: {
  initialQuery?: string
  onPick: (url: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<ImageResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-search when opened with a prefilled query (e.g. the request's name)
  useEffect(() => {
    if (initialQuery.trim()) runSearch(initialQuery)
    // Focus the input so the user can immediately refine
    setTimeout(() => inputRef.current?.focus(), 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const runSearch = (q: string) => {
    const term = q.trim()
    if (!term) { setResults([]); return }
    setError(null)
    setHasSearched(true)
    startTransition(async () => {
      try {
        const items = await searchWebImages(term)
        setResults(items)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed')
        setResults([])
      }
    })
  }

  const handlePick = (url: string) => {
    onPick(url)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[28px] leading-tight font-bold text-text-heading">Search images</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-heading transition-colors" aria-label="Close">
            <X size={22} />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); runSearch(query) }}
          className="flex gap-2 mb-4"
        >
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What are you looking for? (e.g. red Nike Air Max, birthday cake…)"
              className="w-full bg-bg-white border border-border rounded-full pl-9 pr-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isPending || !query.trim()}
            className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isPending ? 'Searching…' : 'Search'}
          </button>
        </form>

        {error && (
          <div className="bg-warning/10 border border-warning/20 rounded-sm px-4 py-3 mb-4 text-caption text-warning font-semibold">
            {error}
          </div>
        )}

        {results.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {results.map((r, i) => (
              <button
                key={`${r.url}-${i}`}
                type="button"
                onClick={() => handlePick(r.url)}
                title={r.title || 'Use this image'}
                className="group relative bg-surface-gray rounded-sm overflow-hidden aspect-square hover:ring-2 hover:ring-primary-teal transition-all"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.thumbUrl}
                  alt={r.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3' }}
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent text-white text-[10px] font-semibold px-2 py-1.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  Tap to use
                </span>
              </button>
            ))}
          </div>
        ) : hasSearched && !isPending && !error ? (
          <p className="text-caption text-text-muted text-center py-12">No results — try a different search.</p>
        ) : !hasSearched ? (
          <p className="text-caption text-text-muted text-center py-12">Type a search above to see image options.</p>
        ) : null}

        <p className="text-[10px] text-text-muted mt-4 text-center">
          Results come from Google Image Search. Safe-search is on.
        </p>
      </div>
    </div>
  )
}
