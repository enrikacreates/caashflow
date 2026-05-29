'use client'

import { useState, useEffect, useMemo, useRef, useTransition } from 'react'
import Link from 'next/link'
import { ShoppingCart, LayoutGrid, List, ImagePlus, SlidersHorizontal, Mic, Trash2, Share2 } from 'lucide-react'
import { deleteBudgetRequest, setRequestStatus, allocateRequestToPeriod, quickAddRequest } from '@/app/actions/requests'
import { formatCurrency, getPillColor, getPriorityColor } from '@/lib/utils'
import type { BudgetRequest, PriorityCategoryRecord } from '@/lib/types'
import RequestFormModal from './RequestFormModal'
import ManageNamesModal from './ManageNamesModal'

interface Props {
  requests: BudgetRequest[]
  categories: PriorityCategoryRecord[]
  activePeriod: { id: string; period_name: string } | null
  familyShare: { name: string; slug: string | null } | null
}

const STATUSES = ['requested', 'approved', 'purchased', 'obtained'] as const
type SortKey = 'priority' | 'amount' | 'recent' | 'name' | 'status'

// Minimal Web Speech API shapes (not in lib.dom) for the quick-add mic
type SpeechRecognitionEventLike = { results: { 0: { 0: { transcript: string } } } }
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: (e: SpeechRecognitionEventLike) => void
  onend: () => void
  onerror: () => void
  start: () => void
}

/** Compact a priority category name down to just its "P7"-style code. */
function priorityCode(name: string): string {
  const m = name.match(/p\s*\d+/i)
  return (m ? m[0] : name.split(':')[0]).replace(/\s+/g, '').toUpperCase().slice(0, 3)
}

const defaultDir = (key: SortKey): 'asc' | 'desc' => (key === 'amount' || key === 'recent' ? 'desc' : 'asc')

export default function RequestsClient({ requests, categories, activePeriod, familyShare }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<BudgetRequest | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [personFilter, setPersonFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [groupByPerson, setGroupByPerson] = useState(false)
  const [view, setView] = useState<'card' | 'list'>('card')
  const [quickName, setQuickName] = useState('')
  const [manageOpen, setManageOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [listening, setListening] = useState(false)
  // Family share popover — link to give to family members so they can add requests without an account
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  const shareWrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => { setOrigin(window.location.origin) }, [])
  useEffect(() => {
    if (!shareOpen) return
    const onClick = (e: MouseEvent) => {
      if (shareWrapRef.current && !shareWrapRef.current.contains(e.target as Node)) setShareOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShareOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [shareOpen])
  const shareLink = familyShare?.slug ? `${origin}/request/${familyShare.slug}` : ''
  const copyShareLink = () => {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 1500)
  }

  // Browser voice dictation → append spoken text into the quick-add box (no auto-submit, so you can review)
  const startVoice = () => {
    const SR = (window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      ?? (window as typeof window & { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition
    if (!SR) { alert('Voice input isn’t supported in this browser. Try Chrome or Safari.'); return }
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      const said = e.results[0][0].transcript.trim()
      setQuickName((prev) => (prev ? `${prev} ${said}` : said))
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    setListening(true)
    rec.start()
  }

  // Parse "Item for Who Amount" → { name, requestedFor, amount }. A $-amount anywhere wins; otherwise
  // a number at the END is taken as the amount (so "Towels for guest 45" → $45, while "2 day trip" stays a name).
  const parseQuickAdd = (raw: string) => {
    let s = raw.trim()
    let amount = 0
    const dollar = s.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/)
    if (dollar) {
      amount = parseFloat(dollar[1].replace(/,/g, '')) || 0
      s = (s.slice(0, dollar.index) + s.slice(dollar.index! + dollar[0].length))
    } else {
      // Trailing number (with optional comma/$ before it) → amount
      const trailing = s.match(/[,\s]\$?([\d,]+(?:\.\d{1,2})?)\s*$/)
      if (trailing) { amount = parseFloat(trailing[1].replace(/,/g, '')) || 0; s = s.slice(0, trailing.index) }
    }
    s = s.replace(/[,\s]+$/, '').trim()
    let requestedFor: string | null = null
    const forMatch = s.match(/\bfor\s+(.+?)\s*$/i)
    if (forMatch) {
      requestedFor = forMatch[1].trim().replace(/^the\s+/i, '')
      s = s.slice(0, forMatch.index).trim()
    }
    const name = s.replace(/[,\s]+$/, '').trim() || raw.trim()
    return { name, requestedFor, amount }
  }

  const quickAdd = () => {
    const raw = quickName.trim()
    if (!raw) return
    const { name, requestedFor, amount } = parseQuickAdd(raw)
    setQuickName('')
    startTransition(() => quickAddRequest(name, requestedFor, amount))
  }

  const categoryColorMap = useMemo(() => new Map(categories.map((c) => [c.name, c.color_key])), [categories])

  // Distinct people already used + static options — feed the form's For combobox.
  const people = useMemo(
    () => [...new Set(requests.map((r) => r.requested_for).filter(Boolean) as string[])].sort(),
    [requests]
  )
  const forWhoOptions = useMemo(() => [...new Set(['Home', 'Family', 'Guests', 'Giving', ...people])], [people])
  const tagOptions = useMemo(() => [...new Set(requests.flatMap((r) => r.tags ?? []))].sort(), [requests])

  const filtered = useMemo(() => {
    let list = [...requests]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.requested_for ?? '').toLowerCase().includes(q) ||
          (r.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    }
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter)
    if (personFilter !== 'all') list = list.filter((r) => (r.requested_for ?? '') === personFilter)
    const mul = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortKey === 'amount') return (a.amount - b.amount) * mul
      if (sortKey === 'recent') return (a.created_at ?? '').localeCompare(b.created_at ?? '') * mul
      if (sortKey === 'name') return a.name.localeCompare(b.name) * mul
      if (sortKey === 'status') return a.status.localeCompare(b.status) * mul
      return (a.priority_category ?? 'Z').localeCompare(b.priority_category ?? 'Z') * mul
    })
    return list
  }, [requests, search, statusFilter, personFilter, sortKey, sortDir])

  const grouped = useMemo(() => {
    if (!groupByPerson) return null
    const map = new Map<string, BudgetRequest[]>()
    for (const r of filtered) {
      const key = r.requested_for || 'Unassigned'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered, groupByPerson])

  const chooseSort = (key: SortKey) => { setSortKey(key); setSortDir(defaultDir(key)) }
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else chooseSort(key)
  }
  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 text-[10px] opacity-50">{sortKey === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
  )

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    startTransition(() => deleteBudgetRequest(id))
  }

  const cycleStatus = (req: BudgetRequest) => {
    const next = STATUSES[(STATUSES.indexOf(req.status as typeof STATUSES[number]) + 1) % STATUSES.length]
    startTransition(() => setRequestStatus(req.id, next))
  }

  const handleAllocate = (req: BudgetRequest) => {
    if (!activePeriod) return
    if (!confirm(`Add "${req.name}" to ${activePeriod.period_name}'s extra expenses?`)) return
    startTransition(() => allocateRequestToPeriod(req.id, activePeriod.id))
  }

  const statusLabel = (s: string) => (s === 'obtained' ? 'Got it' : s)
  // Short "added" label — "1/24/26"
  const addedLabel = (iso: string) => {
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' })
  }
  const statusColor = (s: string) =>
    s === 'obtained' ? 'bg-pill-teal text-text-heading'
    : s === 'purchased' ? 'bg-pill-green text-text-heading'
    : s === 'approved' ? 'bg-pill-blue text-text-heading'
    : 'bg-pill-yellow text-text-heading'

  const card = (req: BudgetRequest) => (
    <div
      key={req.id}
      onClick={() => { setEditItem(req); setModalOpen(true) }}
      title="Click to edit"
      className="bg-bg-white rounded-lg shadow-card overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
    >
      {req.image_url ? (
        <img src={req.image_url} alt="" className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-28 bg-surface-gray flex items-center justify-center text-text-muted/40">
          <ImagePlus size={28} />
        </div>
      )}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-h3 font-semibold text-text-heading line-clamp-2">{req.name}</h3>
          {req.priority_category && (
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getPriorityColor(categoryColorMap.get(req.priority_category))}`}>
              {req.priority_category}
            </span>
          )}
        </div>

        <div className="flex-1">
          {req.amount > 0 && <div className="text-h3 font-bold text-text-heading mb-2">{formatCurrency(req.amount)}</div>}
          {req.requested_for && (
            <div className="text-caption text-text-muted mb-2">for <span className="font-semibold text-text-heading">{req.requested_for}</span></div>
          )}
          {req.url && (
            <a href={req.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-block text-caption text-primary font-semibold hover:underline mb-2">View item ↗</a>
          )}
          {req.tags && req.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {req.tags.map((tag) => (
                <span key={tag} className={`px-2.5 py-0.5 rounded-full text-caption font-medium ${getPillColor(tag)}`}>{tag}</span>
              ))}
            </div>
          )}
          {req.notes && <p className="text-caption text-text-muted italic line-clamp-2">{req.notes}</p>}
          {req.created_at && (
            <p className="text-[10px] text-text-muted mt-2">Added {addedLabel(req.created_at)}</p>
          )}
        </div>

        {activePeriod && req.status !== 'purchased' && (
          <button
            onClick={(e) => { e.stopPropagation(); handleAllocate(req) }}
            disabled={isPending}
            className="mt-3 w-full bg-primary-teal/10 text-primary rounded-full px-4 py-1.5 text-caption font-bold hover:bg-primary-teal/20 disabled:opacity-50 transition-colors"
          >
            + Add to {activePeriod.period_name}
          </button>
        )}

        <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border">
          <div className="flex items-center gap-3">
            {req.status === 'obtained' ? (
              <button onClick={(e) => { e.stopPropagation(); startTransition(() => setRequestStatus(req.id, 'requested')) }} disabled={isPending} className="whitespace-nowrap text-caption text-text-muted hover:text-text-heading font-semibold transition-colors">↩ Reopen</button>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); startTransition(() => setRequestStatus(req.id, 'obtained')) }} disabled={isPending} className="whitespace-nowrap bg-success/10 text-success rounded-full px-3 py-1 text-caption font-bold hover:bg-success/20 disabled:opacity-50 transition-colors">✓ Got it</button>
            )}
            <button onClick={(e) => { e.stopPropagation(); setEditItem(req); setModalOpen(true) }} className="text-caption text-text-muted font-semibold hover:text-text-heading transition-colors">Edit</button>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(req.id, req.name) }} disabled={isPending} aria-label="Delete" title="Delete" className="text-text-muted hover:text-warning transition-colors disabled:opacity-50"><Trash2 size={15} /></button>
          </div>
          <button onClick={(e) => { e.stopPropagation(); cycleStatus(req) }} disabled={isPending} title="Click to change status" className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor(req.status)}`}>
            {statusLabel(req.status)}
          </button>
        </div>
      </div>
    </div>
  )

  const listHeader = (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-beige/40 select-none text-caption font-bold uppercase text-text-muted">
      <div className="w-12 shrink-0" />
      <button onClick={() => handleSort('name')} className="flex-1 min-w-0 text-left hover:text-text-heading transition-colors">Item<SortIcon col="name" /></button>
      <button onClick={() => handleSort('priority')} className="w-12 shrink-0 text-center hover:text-text-heading transition-colors">Pri<SortIcon col="priority" /></button>
      <button onClick={() => handleSort('amount')} className="w-24 shrink-0 text-right hover:text-text-heading transition-colors">Amount<SortIcon col="amount" /></button>
      <button onClick={() => handleSort('status')} className="w-24 shrink-0 text-center hover:text-text-heading transition-colors">Status<SortIcon col="status" /></button>
      <div className="w-[248px] shrink-0" />
    </div>
  )

  const row = (req: BudgetRequest) => (
    <div
      key={req.id}
      onClick={() => { setEditItem(req); setModalOpen(true) }}
      title="Click to edit"
      className="flex items-center gap-3 px-4 py-3 hover:bg-[#f2e9e9] transition-colors cursor-pointer"
    >
      {req.image_url
        ? <img src={req.image_url} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
        : <div className="w-12 h-12 rounded bg-surface-gray shrink-0" />}
      <div className="flex-1 min-w-0">
        <span className="text-caption font-semibold text-text-heading truncate block">{req.name}</span>
        <div className="text-[11px] text-text-muted truncate">
          {req.requested_for && <span>for <span className="font-semibold text-text-heading">{req.requested_for}</span></span>}
          {req.requested_for && (req.tags?.length || req.url) ? ' · ' : ''}
          {req.tags?.join(', ')}
          {req.url && <a href={req.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary font-semibold hover:underline ml-1">↗</a>}
          {req.created_at && (
            <span className="ml-2">· Added {addedLabel(req.created_at)}</span>
          )}
        </div>
      </div>
      <div className="w-12 shrink-0 flex justify-center">
        {req.priority_category && (
          <span title={req.priority_category} className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getPriorityColor(categoryColorMap.get(req.priority_category))}`}>{priorityCode(req.priority_category)}</span>
        )}
      </div>
      <div className="w-24 text-right shrink-0 text-caption font-bold text-text-heading">{req.amount > 0 ? formatCurrency(req.amount) : ''}</div>
      <div className="w-24 shrink-0 flex justify-center">
        <button onClick={(e) => { e.stopPropagation(); cycleStatus(req) }} disabled={isPending} title="Change status" className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor(req.status)}`}>{statusLabel(req.status)}</button>
      </div>
      <div className="w-[248px] shrink-0 flex items-center justify-end gap-2 whitespace-nowrap">
        {activePeriod && req.status !== 'purchased' && (
          <button onClick={(e) => { e.stopPropagation(); handleAllocate(req) }} disabled={isPending} title={`Add to ${activePeriod.period_name}`} className="bg-primary-teal/10 text-primary rounded-full px-3 py-1 text-caption font-bold hover:bg-primary-teal/20 disabled:opacity-50 transition-colors">+ Add</button>
        )}
        {req.status === 'obtained' ? (
          <button onClick={(e) => { e.stopPropagation(); startTransition(() => setRequestStatus(req.id, 'requested')) }} disabled={isPending} className="text-caption text-text-muted hover:text-text-heading font-semibold transition-colors">↩ Reopen</button>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); startTransition(() => setRequestStatus(req.id, 'obtained')) }} disabled={isPending} className="bg-success/10 text-success rounded-full px-3 py-1 text-caption font-bold hover:bg-success/20 disabled:opacity-50 transition-colors">✓ Got it</button>
        )}
        <button onClick={(e) => { e.stopPropagation(); setEditItem(req); setModalOpen(true) }} className="text-caption text-text-muted font-semibold hover:text-text-heading transition-colors">Edit</button>
        <button onClick={(e) => { e.stopPropagation(); handleDelete(req.id, req.name) }} disabled={isPending} className="text-caption text-text-muted hover:text-warning font-semibold transition-colors">Delete</button>
      </div>
    </div>
  )

  const renderItems = (items: BudgetRequest[]) =>
    view === 'list' ? (
      <div className="bg-bg-white rounded-lg shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            {listHeader}
            <div className="divide-y divide-[#e9e9e9]">{items.map(row)}</div>
          </div>
        </div>
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{items.map(card)}</div>
    )

  const selectClass = 'bg-bg-white border border-border rounded-full px-3 py-1.5 text-caption focus:outline-none focus:border-primary transition-colors'

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); quickAdd() }} className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            placeholder="Quick add — e.g. “Towels for Guests 35” then press Enter"
            className="w-full bg-bg-white border border-border rounded-full pl-5 pr-14 py-3 text-caption focus:outline-none focus:border-primary transition-colors shadow-card"
          />
          <button
            type="button"
            onClick={startVoice}
            title={listening ? 'Listening…' : 'Speak to add'}
            aria-label="Voice input"
            className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 transition-colors ${listening ? 'bg-warning/15 text-warning animate-pulse' : 'text-text-muted hover:text-primary hover:bg-surface-beige'}`}
          >
            <Mic size={18} />
          </button>
        </div>
        <p className="text-[11px] text-text-muted mt-1.5 ml-1">Type or speak — <span className="font-semibold">“Item for Who Amount”</span> auto-fills the fields (no $ needed).</p>
      </form>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => { setEditItem(null); setModalOpen(true) }}
          className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-label font-bold hover:opacity-90 transition-opacity"
        >
          + Add Request
        </button>
        <button
          onClick={() => setShowFilters((v) => !v)}
          title="Filters & sorting"
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-caption font-semibold border transition-colors ${showFilters ? 'bg-text-heading text-white border-text-heading' : 'bg-bg-white text-text-muted border-border hover:border-primary'}`}
        >
          <SlidersHorizontal size={15} />
          Filters
        </button>
        <div className="flex rounded-full border border-border overflow-hidden">
          <button onClick={() => setView('card')} title="Card view" className={`px-2.5 py-1.5 transition-colors ${view === 'card' ? 'bg-text-heading text-white' : 'bg-bg-white text-text-muted hover:text-text-heading'}`}>
            <LayoutGrid size={15} />
          </button>
          <button onClick={() => setView('list')} title="List view" className={`px-2.5 py-1.5 transition-colors ${view === 'list' ? 'bg-text-heading text-white' : 'bg-bg-white text-text-muted hover:text-text-heading'}`}>
            <List size={15} />
          </button>
        </div>
        <button
          onClick={() => setManageOpen(true)}
          className="rounded-full px-3 py-1.5 text-caption font-semibold border border-border bg-bg-white text-text-muted hover:border-primary hover:text-text-heading transition-colors"
        >
          Manage names
        </button>
        {/* Share request form — give this link to family members so they can add requests without an account */}
        <div ref={shareWrapRef} className="relative">
          <button
            onClick={() => setShareOpen((v) => !v)}
            title={familyShare?.slug ? 'Share the public request form with family' : 'Set a family name in Settings to enable the share link'}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-semibold border border-border bg-bg-white text-text-muted hover:border-primary hover:text-text-heading transition-colors"
          >
            <Share2 size={14} />
            Share form
          </button>
          {shareOpen && (
            <div className="absolute right-0 top-full mt-2 z-30 w-80 bg-bg-white rounded-lg shadow-lg p-4">
              <div className="text-caption font-bold text-text-heading mb-1">Family request link</div>
              <p className="text-[11px] text-text-muted mb-3">
                Anyone with this link can add to your list — no account needed.
              </p>
              {familyShare?.slug ? (
                <>
                  <div className="flex items-center gap-2 bg-surface-beige rounded-sm px-3 py-2 mb-3">
                    <span className="text-[11px] text-text-muted truncate flex-1">{shareLink || `/request/${familyShare.slug}`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyShareLink}
                      className="bg-primary-teal text-text-inverse rounded-full px-4 py-2 text-caption font-semibold hover:opacity-90 transition-opacity"
                    >
                      {shareCopied ? 'Copied!' : 'Copy link'}
                    </button>
                    {shareLink && (
                      <a
                        href={shareLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-bg-white text-text-heading border border-border rounded-full px-4 py-2 text-caption font-semibold hover:border-primary transition-colors"
                      >
                        Open ↗
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-text-muted mb-3">
                    Set a family name first to generate the link.
                  </p>
                  <Link
                    href="/settings"
                    className="inline-block bg-primary-teal text-text-inverse rounded-full px-4 py-2 text-caption font-semibold hover:opacity-90 transition-opacity"
                  >
                    Go to Settings →
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[140px] bg-bg-white border border-border rounded-full px-4 py-2 text-caption focus:outline-none focus:border-primary transition-colors"
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
            <option value="all">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          {people.length > 0 && (
            <select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} className={selectClass}>
              <option value="all">Everyone</option>
              {people.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          <select value={sortKey} onChange={(e) => chooseSort(e.target.value as SortKey)} className={selectClass}>
            <option value="recent">Sort: Recently added</option>
            <option value="priority">Sort: Priority</option>
            <option value="amount">Sort: Amount</option>
            <option value="name">Sort: Name</option>
            <option value="status">Sort: Status</option>
          </select>
          <button
            onClick={() => setGroupByPerson((g) => !g)}
            className={`rounded-full px-3 py-1.5 text-caption font-semibold border transition-colors ${groupByPerson ? 'bg-text-heading text-white border-text-heading' : 'bg-bg-white text-text-muted border-border hover:border-primary'}`}
          >
            Group by Who/What
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted gap-3">
          <ShoppingCart size={40} className="opacity-30" />
          <p className="text-body">{requests.length === 0 ? 'No requests yet — add your first one!' : 'Nothing matches your filters.'}</p>
        </div>
      ) : grouped ? (
        <div className="space-y-8">
          {grouped.map(([person, items]) => (
            <div key={person}>
              <h2 className="text-h3 font-bold text-text-heading mb-3">{person} <span className="text-caption font-medium text-text-muted">({items.length})</span></h2>
              {renderItems(items)}
            </div>
          ))}
        </div>
      ) : (
        renderItems(filtered)
      )}

      {modalOpen && (
        <RequestFormModal
          editItem={editItem}
          onClose={() => { setModalOpen(false); setEditItem(null) }}
          categories={categories}
          forWhoOptions={forWhoOptions}
          tagOptions={tagOptions}
        />
      )}

      {manageOpen && (
        <ManageNamesModal people={people} tags={tagOptions} onClose={() => setManageOpen(false)} />
      )}
    </>
  )
}
