'use client'

import { useState } from 'react'
import SavingsGoalCard from './SavingsGoalCard'
import SavingsGoalModal from './SavingsGoalModal'
import type { SavingsGoal, BaseBudgetItem } from '@/lib/types'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function SavingsClient({
  goals,
  budgetItems,
}: {
  goals: SavingsGoal[]
  budgetItems: BaseBudgetItem[]
}) {
  const [showModal, setShowModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | undefined>(undefined)
  const [showAchieved, setShowAchieved] = useState(false)

  const activeGoals = goals.filter((g) => !g.is_achieved)
  const achievedGoals = goals.filter((g) => g.is_achieved)

  const purchaseGoals = activeGoals.filter((g) => g.goal_type === 'purchase')
  const fundGoals = activeGoals.filter((g) => g.goal_type === 'fund')

  const totalSaved = activeGoals.reduce((sum, g) => sum + g.current_amount, 0)

  const handleEdit = (goal: SavingsGoal) => {
    setEditingGoal(goal)
    setShowModal(true)
  }

  const handleClose = () => {
    setShowModal(false)
    setEditingGoal(undefined)
  }

  return (
    <>
      {/* Summary */}
      {activeGoals.length > 0 && (
        <div className="bg-white border border-line rounded-[20px] p-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-wide mb-1">
                Total Saved
              </p>
              <p className="text-4xl font-black text-ink">{formatCurrency(totalSaved)}</p>
              <p className="text-sm text-muted mt-1">
                across {activeGoals.length} active goal{activeGoals.length !== 1 ? 's' : ''}
                {purchaseGoals.length > 0 && fundGoals.length > 0 && (
                  <span>
                    {' '}
                    · {purchaseGoals.length} purchase{purchaseGoals.length !== 1 ? 's' : ''},{' '}
                    {fundGoals.length} fund{fundGoals.length !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => {
                setEditingGoal(undefined)
                setShowModal(true)
              }}
              className="bg-blue text-white rounded-[12px] px-5 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity"
            >
              + Add Goal
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {goals.length === 0 && (
        <div className="bg-white border border-line rounded-[20px] p-12 text-center">
          <p className="text-4xl mb-3">🌱</p>
          <p className="font-black font-display text-ink text-xl mb-1">No savings goals yet</p>
          <p className="text-muted text-sm mb-6">
            Track purchases you&apos;re saving for and funds you&apos;re building
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue text-white rounded-[12px] px-6 py-3 text-sm font-bold hover:opacity-90 transition-opacity"
          >
            + Add First Goal
          </button>
        </div>
      )}

      {/* Purchase goals */}
      {purchaseGoals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎯</span>
            <h2 className="text-xs font-bold text-muted uppercase tracking-wide">Saving For</h2>
          </div>
          <div className="space-y-4">
            {purchaseGoals.map((goal) => (
              <SavingsGoalCard key={goal.id} goal={goal} onEdit={handleEdit} />
            ))}
          </div>
        </div>
      )}

      {/* Fund goals */}
      {fundGoals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🌱</span>
            <h2 className="text-xs font-bold text-muted uppercase tracking-wide">Funds</h2>
          </div>
          <div className="space-y-4">
            {fundGoals.map((goal) => (
              <SavingsGoalCard key={goal.id} goal={goal} onEdit={handleEdit} />
            ))}
          </div>
        </div>
      )}

      {/* Add button when no summary */}
      {activeGoals.length === 0 && goals.length > 0 && (
        <button
          onClick={() => {
            setEditingGoal(undefined)
            setShowModal(true)
          }}
          className="bg-blue text-white rounded-[12px] px-5 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity"
        >
          + Add Goal
        </button>
      )}

      {/* Achieved section */}
      {achievedGoals.length > 0 && (
        <div>
          <button
            onClick={() => setShowAchieved((v) => !v)}
            className="text-sm font-bold text-muted hover:text-ink transition-colors flex items-center gap-2"
          >
            <span>{showAchieved ? '▼' : '▶'}</span>
            {achievedGoals.length} Achieved 🎉
          </button>
          {showAchieved && (
            <div className="space-y-2 mt-3">
              {achievedGoals.map((goal) => (
                <SavingsGoalCard key={goal.id} goal={goal} onEdit={handleEdit} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <SavingsGoalModal goal={editingGoal} budgetItems={budgetItems} onClose={handleClose} />
      )}
    </>
  )
}
