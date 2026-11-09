-- Archived baseline items stop landing in new budgets and leave the dashboard and
-- totals; budgets they already appear in keep them. Null = active.
ALTER TABLE caashflow.base_budget_items ADD COLUMN archived_at TIMESTAMPTZ;
