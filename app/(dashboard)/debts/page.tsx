import { getDebts } from '@/app/actions/debts'
import { getBaseBudgetItems } from '@/app/actions/base-budget'
import DebtsClient from '@/components/debts/DebtsClient'

export default async function DebtsPage() {
  const [debts, budgetItems] = await Promise.all([getDebts(), getBaseBudgetItems()])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black font-display text-ink">Debt Paydown</h1>
        <p className="text-muted text-sm mt-1">Track your debts and celebrate every payment</p>
      </div>
      <DebtsClient debts={debts} budgetItems={budgetItems} />
    </div>
  )
}
