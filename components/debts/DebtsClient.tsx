'use client'

import { useState } from 'react'
import DebtCard from './DebtCard'
import DebtModal from './DebtModal'
import type { Debt, BaseBudgetItem } from '@/lib/types'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

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
        <div className="bg-white border border-line rounded-[20px] p-6">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-wide mb-1">
                Total Remaining
              </p>
              <p className="text-4xl font-black text-ink">{formatCurrency(totalRemaining)}</p>
              <p className="text-sm text-muted mt-1">
                across {activeDebts.length} debt{activeDebts.length !== 1 ? 's' : ''}
                {totalOriginal > 0 && ` · ${Math.round(overallProgress)}% paid overall`}
              </p>
            </div>
            <button
              onClick={() => { setEditingDebt(undefined); setShowModal(true) }}
              className="bg-blue text-white rounded-[12px] px-5 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity"
            >
              + Add Debt
            </button>
          </div>

          {totalOriginal > 0 && (
            <div className="w-full bg-line rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full bg-green transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {debts.length === 0 && (
        <div className="bg-white border border-line rounded-[20px] p-12 text-center">
          <p className="text-4xl mb-3">💪</p>
          <p className="font-black font-display text-ink text-xl mb-1">No debts tracked yet</p>
          <p className="text-muted text-sm mb-6">Add your first debt to start tracking progress</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue text-white rounded-[12px] px-6 py-3 text-sm font-bold hover:opacity-90 transition-opacity"
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
          className="bg-blue text-white rounded-[12px] px-5 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity"
        >
          + Add Debt
        </button>
      )}

      {/* Paid off section */}
      {paidOffDebts.length > 0 && (
        <div>
          <button
            onClick={() => setShowPaidOff((v) => !v)}
            className="text-sm font-bold text-muted hover:text-ink transition-colors flex items-center gap-2"
          >
            <span>{showPaidOff ? '▼' : '▶'}</span>
            {paidOffDebts.length} Paid Off 🎉
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
