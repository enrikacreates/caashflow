'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import CreatePeriodModal from '@/components/periods/CreatePeriodModal'

export default function NewBudgetButton() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 transition-opacity shadow-card"
      >
        <Plus size={16} strokeWidth={2.5} />
        New Budget
      </button>

      {modalOpen && <CreatePeriodModal onClose={() => setModalOpen(false)} />}
    </>
  )
}
