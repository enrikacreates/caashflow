'use client'

import { useState, useTransition } from 'react'
import { ShoppingCart, ChevronDown } from 'lucide-react'
import { deleteBudgetRequest } from '@/app/actions/requests'
import { formatCurrency, getPillColor } from '@/lib/utils'
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

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    startTransition(() => deleteBudgetRequest(id))
  }

  return (
    <>
      <div className="flex mb-6">
        <button
          onClick={() => { setEditItem(null); setModalOpen(true) }}
          className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-label font-bold hover:opacity-90 transition-opacity"
        >
          + Add to List
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted gap-3">
          <ShoppingCart size={40} className="opacity-30" />
          <p className="text-body">No next buys yet — add something to your list!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-bg-white rounded-lg shadow-card p-6 flex flex-col">
              {/* Header */}
              <div className="mb-3">
                <h3 className="text-h3 font-semibold text-text-heading line-clamp-2">{req.name}</h3>
              </div>

              {/* Body — grows to push footer down */}
              <div className="flex-1">
                {/* Amount */}
                {req.amount > 0 && (
                  <div className="text-h3 font-bold text-text-heading mb-2">{formatCurrency(req.amount)}</div>
                )}

                {/* Tags */}
                {req.tags && req.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {req.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-2.5 py-0.5 rounded-full text-caption font-medium ${getPillColor(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {req.notes && (
                  <p className="text-caption text-text-muted italic line-clamp-1">{req.notes}</p>
                )}
              </div>

              {/* Footer — always at bottom */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
                <div className="flex gap-3">
                  <button
                    onClick={() => { setEditItem(req); setModalOpen(true) }}
                    className="text-caption text-primary font-semibold hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(req.id, req.name)}
                    disabled={isPending}
                    className="text-caption text-text-muted hover:text-warning font-semibold transition-colors"
                  >
                    Delete
                  </button>
                </div>
                <span className="flex items-center gap-0.5 text-caption font-semibold text-text-muted">
                  {req.status}
                  <ChevronDown size={12} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <RequestFormModal
          editItem={editItem}
          onClose={() => { setModalOpen(false); setEditItem(null) }}
          categories={categories}
        />
      )}
    </>
  )
}
