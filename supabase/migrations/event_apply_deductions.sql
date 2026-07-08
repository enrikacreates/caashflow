-- Event budgets: opt-in deductions + account transfers.
-- When apply_deductions = true on an event budget, the period runs tithe/savings/
-- tax/profit/giving deductions and shows account transfers just like a monthly
-- budget. Monthly budgets always deduct, regardless of this flag.
-- Applied to theDailyStory / caashflow schema via MCP apply_migration.

alter table caashflow.budget_periods
  add column if not exists apply_deductions boolean not null default false;

comment on column caashflow.budget_periods.apply_deductions is
  'Event budgets only: when true, run tithe/savings/tax/profit/giving deductions and account transfers just like a monthly budget. Monthly budgets always deduct regardless of this flag.';
