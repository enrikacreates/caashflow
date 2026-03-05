import { getInvoices } from '@/app/actions/invoices'
import { getBudgetPeriods } from '@/app/actions/periods'
import InvoicesClient from '@/components/invoices/InvoicesClient'

export default async function InvoicesPage() {
  const [invoices, periods] = await Promise.all([
    getInvoices(),
    getBudgetPeriods(),
  ])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-h1 font-bold text-text-heading">Incoming Caashflow</h1>
        <p className="text-text-muted text-sm mt-1">Track all your income — invoices, sales, gifts & more</p>
      </div>
      <InvoicesClient invoices={invoices} periods={periods} />
    </div>
  )
}
