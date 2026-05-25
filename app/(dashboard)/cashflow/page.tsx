import { getInvoices } from '@/app/actions/invoices'
import { getBudgetPeriods } from '@/app/actions/periods'
import { getSettings } from '@/app/actions/settings'
import InvoicesClient from '@/components/invoices/InvoicesClient'
import CashFlowChart from '@/components/dashboard/CashFlowChart'

export default async function CashFlowPage() {
  const [invoices, periods, settings] = await Promise.all([
    getInvoices(),
    getBudgetPeriods(),
    getSettings(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h1 font-bold text-text-heading">Caashflow</h1>
        <p className="text-body text-text-muted mt-1">Track all your income — invoices, sales, gifts &amp; more</p>
      </div>
      <CashFlowChart invoices={invoices} incomeGoal={settings.monthly_income_goal} />
      <InvoicesClient invoices={invoices} periods={periods} />
    </div>
  )
}
