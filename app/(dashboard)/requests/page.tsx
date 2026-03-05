import { getBudgetRequests } from '@/app/actions/requests'
import { getPriorityCategories } from '@/app/actions/settings'
import RequestsClient from '@/components/requests/RequestsClient'

export default async function RequestsPage() {
  const [requests, categories] = await Promise.all([
    getBudgetRequests(),
    getPriorityCategories(),
  ])

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-h1 font-bold text-text-heading">Next Buys</h1>
        <p className="text-body text-text-muted mt-1">Your wishlist and upcoming purchases</p>
      </div>
      <RequestsClient requests={requests} categories={categories ?? []} />
    </div>
  )
}
