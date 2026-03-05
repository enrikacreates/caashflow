'use client'

import { useState } from 'react'
import { Sprout, Target, Trophy, ChevronDown, ChevronRight } from 'lucide-react'
import SavingsGoalCard from './SavingsGoalCard'
import SavingsGoalModal from './SavingsGoalModal'
import { formatCurrency } from '@/lib/utils'
import type { SavingsGoal, BaseBudgetItem } from '@/lib/types'

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
        <div className="bg-bg-white rounded-lg shadow-card p-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-caption font-semibold text-text-muted uppercase tracking-wide mb-1">
                Total Saved
              </p>
              <p className="text-h1 font-bold text-text-heading">{formatCurrency(totalSaved)}</p>
              <p className="text-caption text-text-muted mt-1">
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
              className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 transition-opacity"
            >
              + Add Goal
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {goals.length === 0 && (
        <div className="bg-bg-white rounded-lg shadow-card p-12 text-center">
          <Sprout size={48} strokeWidth={1.5} className="text-text-muted mx-auto mb-4" />
          <p className="font-bold text-text-heading text-h3 mb-1">No savings goals yet</p>
          <p className="text-caption text-text-muted mb-6">
            Track purchases you&apos;re saving for and funds you&apos;re building
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary-teal text-text-inverse rounded-full px-6 py-3 text-caption font-semibold hover:opacity-90 transition-opacity"
          >
            + Add First Goal
          </button>
        </div>
      )}

      {/* Purchase goals */}
      {purchaseGoals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-text-muted" />
            <h2 className="text-caption font-semibold text-text-muted uppercase tracking-wide">
              Saving For
            </h2>
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
            <Sprout size={16} className="text-text-muted" />
            <h2 className="text-caption font-semibold text-text-muted uppercase tracking-wide">
              Funds
            </h2>
          </div>
          <div className="space-y-4">
            {fundGoals.map((goal) => (
              <SavingsGoalCard key={goal.id} goal={goal} onEdit={handleEdit} />
            ))}
          </div>
        </div>
      )}

      {/* Add button when no summary (only achieved goals remain) */}
      {activeGoals.length === 0 && goals.length > 0 && (
        <button
          onClick={() => {
            setEditingGoal(undefined)
            setShowModal(true)
          }}
          className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 transition-opacity"
        >
          + Add Goal
        </button>
      )}

      {/* Achieved section */}
      {achievedGoals.length > 0 && (
        <div>
          <button
            onClick={() => setShowAchieved((v) => !v)}
            className="text-caption font-semibold text-text-muted hover:text-text-heading transition-colors flex items-center gap-2"
          >
            {showAchieved ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {achievedGoals.length} Achieved
            <Trophy size={14} className="text-warning" />
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
