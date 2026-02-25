export interface Household {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface HouseholdMember {
  id: string
  household_id: string
  user_id: string
  role: 'owner' | 'member'
  email: string | null
  created_at: string
}

export interface HouseholdInvite {
  id: string
  household_id: string
  token: string
  invited_by: string
  status: 'pending' | 'accepted' | 'expired'
  created_at: string
  expires_at: string
}

export interface Settings {
  id: string
  household_id: string
  tithe_percentage: number
  savings_percentage: number
  tax_percentage: number
  profit_percentage: number
  fun_money_percentage: number
  updated_at: string
}

export interface BaseBudgetItem {
  id: string
  household_id: string
  name: string
  default_amount: number
  due_day: number | null
  account: string | null
  priority_category: string | null
  frequency: Frequency
  auto_pay: boolean
  pay_url: string | null
  notes: string | null
  tags: string[]
  sort_order: number
  created_at: string
  updated_at: string
}

export interface BudgetPeriod {
  id: string
  household_id: string
  period_name: string
  income_amount: number
  deduction_overrides: DeductionOverrides
  created_at: string
  updated_at: string
}

export interface PeriodExpense {
  id: string
  period_id: string
  household_id: string
  base_item_id: string | null
  name: string
  default_amount: number
  due_day: number | null
  account: string | null
  priority_category: string | null
  frequency: Frequency
  auto_pay: boolean
  pay_url: string | null
  notes: string | null
  tags: string[]
  pay_now: boolean
  transferred: boolean
  paid: boolean
  cleared: boolean
  amount_override: number | null
  override_notes: string | null
  is_partial: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  household_id: string
  client_name: string
  project_name: string | null
  amount: number
  status: InvoiceStatus
  projected_date: string | null
  actual_received_date: string | null
  month: string | null
  created_at: string
  updated_at: string
}

export interface PeriodLinkedInvoice {
  id: string
  period_id: string
  invoice_id: string
}

export interface PeriodManualIncome {
  id: string
  period_id: string
  household_id: string
  description: string
  amount: number
  created_at: string
}

export interface BudgetRequest {
  id: string
  household_id: string
  name: string
  amount: number
  priority_category: string
  status: RequestStatus
  tags: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DeductionOverrides {
  tithe_percentage?: number
  savings_percentage?: number
  tax_percentage?: number
  profit_percentage?: number
  fun_money_percentage?: number
}

export type Frequency = 'Monthly' | 'Weekly' | 'Annually' | 'One-Time'
export type InvoiceStatus = 'projected' | 'sent' | 'received'
export type RequestStatus = 'requested' | 'approved' | 'purchased'
export type PriorityCategory =
  | 'P0: Lifeline'
  | 'P1: Essentials'
  | 'P3: Debt'
  | 'P4: Business | Education'
  | 'P5: Lifestyle'
  | 'P7: UpNext'

export const PRIORITY_CATEGORIES: PriorityCategory[] = [
  'P0: Lifeline',
  'P1: Essentials',
  'P3: Debt',
  'P4: Business | Education',
  'P5: Lifestyle',
  'P7: UpNext',
]

export const FREQUENCIES: Frequency[] = ['Monthly', 'Weekly', 'Annually', 'One-Time']

export const ACCOUNTS = ['Opt X', 'Owners Comp', 'Personal Savings']
