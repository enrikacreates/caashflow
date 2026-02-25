import { getBudgetPeriods } from '@/app/actions/periods'
import PeriodsClient from '@/components/periods/PeriodsClient'

export default async function PeriodsPage() {
  const periods = await getBudgetPeriods()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black font-display text-ink">Budget Periods</h1>
        <p className="text-muted text-sm mt-1">Create and manage your pay period budgets</p>
      </div>
      <PeriodsClient periods={periods} />
    </div>
  )
}
