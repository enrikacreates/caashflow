'use client'

import { useState } from 'react'
import { Hammer, Trophy, ChevronDown, ChevronRight } from 'lucide-react'
import DebtCard from './DebtCard'
import DebtModal from './DebtModal'
import { formatCurrency } from '@/lib/utils'
import type { Debt, BaseBudgetItem } from '@/lib/types'

export default function DebtsClient({
  debts,
  budgetItems,
}: {
  debts: Debt[]
  budgetItems: BaseBudgetItem[]
}) {
  const [showModal, setShowModal] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | undefined>(undefined)
  const [showPaidOff, setShowPaidOff] = useState(false)

  const activeDebts = debts.filter((d) => !d.is_paid_off)
  const paidOffDebts = debts.filter((d) => d.is_paid_off)

  const totalRemaining = activeDebts.reduce((sum, d) => sum + d.current_balance, 0)
  const totalOriginal = activeDebts.reduce((sum, d) => sum + d.original_balance, 0)
  const totalPaid = totalOriginal - totalRemaining
  const overallProgress = totalOriginal > 0 ? (totalPaid / totalOriginal) * 100 : 0

  const handleEdit = (debt: Debt) => {
    setEditingDebt(debt)
    setShowModal(true)
  }

  const handleClose = () => {
    setShowModal(false)
    setEditingDebt(undefined)
  }

  return (
    <>
      {/* Summary */}
      {activeDebts.length > 0 && (
        <div className="bg-bg-white rounded-lg shadow-card p-6">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-caption font-semibold text-text-muted uppercase tracking-wide mb-1">
                Total Remaining
              </p>
              <p className="text-h1 font-bold text-text-heading">{formatCurrency(totalRemaining)}</p>
              <p className="text-caption text-text-muted mt-1">
                across {activeDebts.length} debt{activeDebts.length !== 1 ? 's' : ''}
                {totalOriginal > 0 && ` · ${Math.round(overallProgress)}% paid overall`}
              </p>
            </div>
            <button
              onClick={() => { setEditingDebt(undefined); setShowModal(true) }}
              className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 transition-opacity"
            >
              + Add Debt
            </button>
          </div>

          {totalOriginal > 0 && (
            <div className="w-full bg-surface-gray rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full bg-primary-teal transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {debts.length === 0 && (
        <div className="bg-bg-white rounded-lg shadow-card p-12 text-center">
          <Hammer size={48} strokeWidth={1.5} className="text-text-muted mx-auto mb-4" />
          <p className="font-bold text-text-heading text-h3 mb-1">No debts tracked yet</p>
          <p className="text-caption text-text-muted mb-6">Add your first debt to start tracking progress</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary-teal text-text-inverse rounded-full px-6 py-3 text-caption font-semibold hover:opacity-90 transition-opacity"
          >
            + Add First Debt
          </button>
        </div>
      )}

      {/* Active debts */}
      {activeDebts.length > 0 && (
        <div className="space-y-4">
          {activeDebts.map((debt) => (
            <DebtCard key={debt.id} debt={debt} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {/* Add button when no summary (only paid off or mix) */}
      {activeDebts.length === 0 && debts.length > 0 && (
        <button
          onClick={() => { setEditingDebt(undefined); setShowModal(true) }}
          className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 transition-opacity"
        >
          + Add Debt
        </button>
      )}

      {/* Paid off section */}
      {paidOffDebts.length > 0 && (
        <div>
          <button
            onClick={() => setShowPaidOff((v) => !v)}
            className="text-caption font-semibold text-text-muted hover:text-text-heading transition-colors flex items-center gap-2"
          >
            {showPaidOff ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {paidOffDebts.length} Paid Off
            <Trophy size={14} className="text-warning" />
          </button>
          {showPaidOff && (
            <div className="space-y-2 mt-3">
              {paidOffDebts.map((debt) => (
                <DebtCard key={debt.id} debt={debt} onEdit={handleEdit} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <DebtModal debt={editingDebt} budgetItems={budgetItems} onClose={handleClose} />
      )}
    </>
  )
}
