import { getPeriodDetail, getBudgetPeriods } from '@/app/actions/periods'
import { getPriorityCategories } from '@/app/actions/settings'
import { getBudgetRequests } from '@/app/actions/requests'
import PeriodSessions from '@/components/period-detail/PeriodSessions'
import PeriodPicker from '@/components/period-detail/PeriodPicker'
import NewBudgetButton from '@/components/dashboard/NewBudgetButton'

export default async function PeriodDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ periodId: string }>
  searchParams: Promise<{ s?: string }>
}) {
  const { periodId } = await params
  const { s: initialTab } = await searchParams
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
      <PeriodSessions
        period={detail.period}
        sessions={detail.sessions}
        expenses={detail.expenses}
        linkedInvoices={detail.linkedInvoices}
        manualIncome={detail.manualIncome}
        linkableInvoices={detail.linkableInvoices}
        settings={detail.settings}
        accounts={detail.accounts}
        adjustments={detail.adjustments}
        expenseTransfers={detail.expenseTransfers ?? []}
        categories={categories ?? []}
        savingsGoals={detail.savingsGoals}
        savingsAllocations={detail.savingsAllocations}
        lastPeriodAllocations={detail.lastPeriodAllocations}
        requests={requests ?? []}
        accountTransfers={detail.accountTransfers}
        initialTab={initialTab}
      />
    </div>
  )
}
