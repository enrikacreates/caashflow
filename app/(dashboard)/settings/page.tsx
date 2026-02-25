import { getSettings, getAccounts, getPriorityCategories } from '@/app/actions/settings'
import { getHouseholdMembers } from '@/app/actions/household'
import { getAuthUser } from '@/lib/supabase/helpers'
import SettingsForm from '@/components/settings/SettingsForm'
import DataManagement from '@/components/settings/DataManagement'
import MembersPanel from '@/components/settings/MembersPanel'
import AccountsPanel from '@/components/settings/AccountsPanel'
import CategoriesPanel from '@/components/settings/CategoriesPanel'
import type { Settings } from '@/lib/types'

export default async function SettingsPage() {
  const [settings, members, user, accounts, categories] = await Promise.all([
    getSettings() as Promise<Settings>,
    getHouseholdMembers(),
    getAuthUser(),
    getAccounts(),
    getPriorityCategories(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black font-display text-ink">Settings</h1>
        <p className="text-muted text-sm mt-1">Manage your deduction percentages and data</p>
      </div>

      <SettingsForm settings={settings} />
      <AccountsPanel accounts={accounts ?? []} />
      <CategoriesPanel categories={categories ?? []} />
      <MembersPanel members={members ?? []} currentUserId={user?.id ?? ''} />
      <DataManagement />
    </div>
  )
}
