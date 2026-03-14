import { getSettings, getAccounts, getPriorityCategories } from '@/app/actions/settings'
import { getHouseholdMembers, getUserHouseholdsWithNames } from '@/app/actions/household'
import { getProfile } from '@/app/actions/profile'
import { getAuthUser } from '@/lib/supabase/helpers'
import SettingsForm from '@/components/settings/SettingsForm'
import DataManagement from '@/components/settings/DataManagement'
import MembersPanel from '@/components/settings/MembersPanel'
import AccountsPanel from '@/components/settings/AccountsPanel'
import CategoriesPanel from '@/components/settings/CategoriesPanel'
import ProfilePanel from '@/components/settings/ProfilePanel'
import type { Settings } from '@/lib/types'

export default async function SettingsPage() {
  const [settings, members, user, accounts, categories, profile, households] = await Promise.all([
    getSettings() as Promise<Settings>,
    getHouseholdMembers(),
    getAuthUser(),
    getAccounts(),
    getPriorityCategories(),
    getProfile(),
    getUserHouseholdsWithNames(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h1 font-bold text-text-heading">Settings</h1>
        <p className="text-body text-text-muted mt-1">Manage your profile, deductions, and data</p>
      </div>

      <ProfilePanel
        profile={profile}
        email={user?.email ?? ''}
        households={households ?? []}
      />
      <SettingsForm settings={settings} />
      <AccountsPanel accounts={accounts ?? []} />
      <CategoriesPanel categories={categories ?? []} />
      <MembersPanel members={members ?? []} currentUserId={user?.id ?? ''} />
      <DataManagement />
    </div>
  )
}
