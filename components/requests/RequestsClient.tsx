'use client'

import { useState, useTransition } from 'react'
import { deleteBudgetRequest } from '@/app/actions/requests'
import { formatCurrency, getPriorityColor, getStatusColor } from '@/lib/utils'
import type { BudgetRequest, PriorityCategoryRecord } from '@/lib/types'
import RequestFormModal from './RequestFormModal'

interface Props {
  requests: BudgetRequest[]
  categories: PriorityCategoryRecord[]
}

export default function RequestsClient({ requests, categories }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<BudgetRequest | null>(null)

  // Build a lookup map: category name → color_key
  const categoryColorMap = new Map(categories.map(c => [c.name, c.color_key]))

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    startTransition(() => deleteBudgetRequest(id))
  }

  return (
    <>
      <div className="flex mb-6">
        <button onClick={() => { setEditItem(null); setModalOpen(true) }}
          className="bg-blue text-white rounded-[12px] px-5 py-2.5 font-bold hover:opacity-90 text-sm">
          + Add Request
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <div className="text-4xl mb-4 opacity-50">🛒</div>
          <p>No budget requests yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-white border border-line rounded-[20px] p-6 hover:border-blue transition-colors">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-ink">{req.name}</h3>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(req.status)}`}>
                  {req.status}
                </span>
              </div>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase mb-3 ${getPriorityColor(categoryColorMap.get(req.priority_category))}`}>
                {req.priority_category}
              </span>
              {req.amount > 0 && (
                <div className="text-lg font-bold text-ink mb-2">{formatCurrency(req.amount)}</div>
              )}
              {req.tags && req.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {req.tags.map((tag) => (
                    <span key={tag} className="bg-cream-2 border border-line rounded-full px-2 py-0.5 text-xs text-muted font-medium">{tag}</span>
                  ))}
                </div>
              )}
              {req.notes && <p className="text-sm text-muted mb-3">{req.notes}</p>}
              <div className="flex gap-2 pt-2 border-t border-line">
                <button onClick={() => { setEditItem(req); setModalOpen(true) }}
                  className="text-xs text-blue font-bold hover:underline">Edit</button>
                <button onClick={() => handleDelete(req.id, req.name)} disabled={isPending}
                  className="text-xs text-orange font-bold hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <RequestFormModal editItem={editItem} onClose={() => { setModalOpen(false); setEditItem(null) }} categories={categories} />
      )}
    </>
  )
}
