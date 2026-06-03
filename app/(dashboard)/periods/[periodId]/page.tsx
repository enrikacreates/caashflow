import { getPeriodDetail, getBudgetPeriods } from '@/app/actions/periods'
import { getPriorityCategories } from '@/app/actions/settings'
import { getBudgetRequests } from '@/app/actions/requests'
import PeriodDetailClient from '@/components/period-detail/PeriodDetailClient'
import PeriodPicker from '@/components/period-detail/PeriodPicker'
import NewBudgetButton from '@/components/dashboard/NewBudgetButton'

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ periodId: string }>
}) {
  const { periodId } = await params
  const [detail, categories, requests, allPeriods] = await Promise.all([
    getPeriodDetail(periodId),
    getPriorityCategories(),
    getBudgetRequests(),
    getBudgetPeriods(),
  ])

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <PeriodPicker current={detail.period} periods={allPeriods ?? []} />
          <p className="text-caption text-text-muted mt-1">
            {detail.period.kind === 'event'
              ? 'Track contributions and expenses for this event — isolated from your monthly budget rollups.'
              : 'Manage income, deductions, and expenses for this period'}
          </p>
        </div>
        <NewBudgetButton />
      </div>
      <PeriodDetailClient
        period={detail.period}
        expenses={detail.expenses}
        linkedInvoices={detail.linkedInvoices}
        manualIncome={detail.manualIncome}
        linkableInvoices={detail.linkableInvoices}
        settings={detail.settings}
        accounts={detail.accounts}
        deductionContributions={detail.deductionContributions}
        adjustments={detail.adjustments}
        expenseTransfers={detail.expenseTransfers ?? []}
        categories={categories ?? []}
        savingsGoals={detail.savingsGoals}
        savingsAllocations={detail.savingsAllocations}
        lastPeriodAllocations={detail.lastPeriodAllocations}
        requests={requests ?? []}
        accountTransfersDone={detail.accountTransfersDone ?? []}
        accountsCashDone={detail.accountsCashDone ?? []}
      />
    </div>
  )
}
