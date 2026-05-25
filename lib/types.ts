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
  monthly_expense_goal: number | null
  monthly_income_goal: number | null
  // Account each deduction is set aside into — feeds the Account Transfers breakdown
  tithe_account: string | null
  savings_account: string | null
  tax_account: string | null
  profit_account: string | null
  fun_money_account: string | null
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
  debt_id: string | null
  savings_goal_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface BudgetPeriod {
  id: string
  household_id: string
  period_name: string
  period_month: string | null
  income_amount: number
  deduction_overrides: DeductionOverrides
  // Per-deduction "set aside / paid" checkmarks, keyed by tithe|savings|tax|profit|fun_money
  deduction_paid: Record<string, boolean>
  status: PeriodStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface PeriodAdjustment {
  id: string
  household_id: string
  period_id: string
  amount: number
  note: string | null
  sort_order: number
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
  is_split: boolean
  is_complete: boolean
  is_overdue: boolean
  amount_override: number | null
  override_notes: string | null
  paid_amount: number
  debt_id: string | null
  savings_goal_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
  // Sub-payment rows when is_split is true (joined by getPeriodDetail)
  payments?: PeriodExpensePayment[]
}

export interface PeriodExpensePayment {
  id: string
  household_id: string
  period_expense_id: string
  label: string | null
  amount: number
  due_day: number | null
  pay_now: boolean
  transferred: boolean
  paid: boolean
  cleared: boolean
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
  budgeted: boolean
  created_at: string
  updated_at: string
  // Joined from period_linked_invoices → budget_periods (populated by getInvoices)
  period_linked_invoices?: Array<{
    period_id: string
    budget_periods: { id: string; period_name: string } | null
  }>
}

export interface PeriodLinkedInvoice {
  id: string
  period_id: string
  invoice_id: string
  is_done: boolean
}

export interface PeriodManualIncome {
  id: string
  period_id: string
  household_id: string
  description: string
  amount: number
  is_done: boolean
  created_at: string
}

export interface PeriodDeductionContribution {
  id: string
  household_id: string
  period_id: string
  source_kind: 'manual' | 'invoice'
  source_id: string
  source_label: string | null
  income_amount: number
  tithe: number
  savings: number
  tax: number
  profit: number
  fun_money: number
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
  requested_for: string | null
  image_url: string | null
  url: string | null
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  household_id: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PriorityCategoryRecord {
  id: string
  household_id: string
  name: string
  color_key: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Debt {
  id: string
  household_id: string
  name: string
  original_balance: number
  current_balance: number
  interest_rate: number | null
  minimum_payment: number | null
  due_day: number | null
  notes: string | null
  is_paid_off: boolean
  paid_off_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SavingsGoal {
  id: string
  household_id: string
  name: string
  goal_type: 'purchase' | 'fund'
  target_amount: number
  current_amount: number
  monthly_contribution: number | null
  target_date: string | null
  notes: string | null
  is_achieved: boolean
  achieved_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SavingsGoalAdjustment {
  id: string
  household_id: string
  savings_goal_id: string
  amount: number
  note: string | null
  created_at: string
}

export interface PeriodSavingsAllocation {
  id: string
  period_id: string
  household_id: string
  savings_goal_id: string
  amount: number
  contributed: number
  created_at: string
  updated_at: string
}

export interface DeductionOverrides {
  tithe_percentage?: number
  savings_percentage?: number
  tax_percentage?: number
  profit_percentage?: number
  fun_money_percentage?: number
  // Dollar-amount overrides (used when % | $ toggle is set to $)
  tithe_amount?: number
  savings_amount?: number
  tax_amount?: number
  profit_amount?: number
  fun_money_amount?: number
}

export interface UserProfile {
  id: string
  user_id: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Frequency = 'Monthly' | 'Weekly' | 'Annually' | 'One-Time'
export type PeriodStatus = 'active' | 'complete'
export type InvoiceStatus = 'projected' | 'sent' | 'received'
export type RequestStatus = 'requested' | 'approved' | 'purchased' | 'obtained'

export const FREQUENCIES: Frequency[] = ['Monthly', 'Weekly', 'Annually', 'One-Time']
