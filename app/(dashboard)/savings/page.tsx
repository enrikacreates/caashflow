import { getSavingsGoals } from '@/app/actions/savings'
import { getBaseBudgetItems } from '@/app/actions/base-budget'
import SavingsClient from '@/components/savings/SavingsClient'

export const metadata = { title: 'Savings Goals — Caashflow' }

export default async function SavingsPage() {
  const [goals, budgetItems] = await Promise.all([getSavingsGoals(), getBaseBudgetItems()])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-h1 font-bold text-text-heading">Savings Goals</h1>
        <p className="text-caption text-text-muted mt-1">Track purchases you&apos;re saving for and funds you&apos;re building.</p>
      </div>
      <SavingsClient goals={goals} budgetItems={budgetItems} />
    </div>
  )
}
