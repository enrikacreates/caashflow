import { getDebts } from '@/app/actions/debts'
import { getBaseBudgetItems } from '@/app/actions/base-budget'
import DebtsClient from '@/components/debts/DebtsClient'

export default async function DebtsPage() {
  const [debts, budgetItems] = await Promise.all([getDebts(), getBaseBudgetItems()])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h1 font-bold text-text-heading">Debt Demo</h1>
        <p className="text-caption text-text-muted mt-1">Demolish your debts and celebrate every payment</p>
      </div>
      <DebtsClient debts={debts} budgetItems={budgetItems} />
    </div>
  )
}
