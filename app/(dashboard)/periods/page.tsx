import { getBudgetPeriods } from '@/app/actions/periods'
import PeriodsClient from '@/components/periods/PeriodsClient'

export default async function PeriodsPage() {
  const periods = await getBudgetPeriods()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h1 font-semibold text-text-heading">Budgets</h1>
        <p className="text-caption text-text-muted mt-1">Create and manage your budgets</p>
      </div>
      <PeriodsClient periods={periods} />
    </div>
  )
}
