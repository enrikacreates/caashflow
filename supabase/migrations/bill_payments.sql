-- ============================================================
-- Migration: bills paid outside a budget (theDailyStory caashflow schema)
--
-- bill_payments records money that left without budgeted income behind it:
-- date, amount, account, optional month it was for, optional note. It points at
-- the budget line when there is one; otherwise it holds the baseline item and
-- month, and attaches itself when that month's budget gets created.
-- period_expenses.paid_outside marks the line so budget math skips it.
-- ============================================================

BEGIN;

ALTER TABLE caashflow.period_expenses
  ADD COLUMN paid_outside BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE caashflow.bill_payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  expense_id   UUID REFERENCES caashflow.period_expenses(id) ON DELETE SET NULL,
  base_item_id UUID REFERENCES caashflow.base_budget_items(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  amount       NUMERIC NOT NULL,
  account      TEXT,
  paid_on      DATE NOT NULL,
  -- First of the month this payment was for; null = not specified
  for_month    DATE,
  note         TEXT,
  -- The line's amount_override before this payment, restored on undo
  prior_amount_override NUMERIC,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A bill can only be paid once: a double tap can't record it twice
CREATE UNIQUE INDEX bill_payments_one_per_line ON caashflow.bill_payments(expense_id) WHERE expense_id IS NOT NULL;
CREATE UNIQUE INDEX bill_payments_one_per_month ON caashflow.bill_payments(base_item_id, for_month) WHERE expense_id IS NULL;
CREATE INDEX idx_bill_payments_team ON caashflow.bill_payments(team_id);

ALTER TABLE caashflow.bill_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_select ON caashflow.bill_payments FOR SELECT
  USING (team_id IN (SELECT caashflow.user_team_ids()));
CREATE POLICY team_insert ON caashflow.bill_payments FOR INSERT
  WITH CHECK (team_id IN (SELECT caashflow.user_full_access_team_ids()));
CREATE POLICY team_update ON caashflow.bill_payments FOR UPDATE
  USING (team_id IN (SELECT caashflow.user_full_access_team_ids()))
  WITH CHECK (team_id IN (SELECT caashflow.user_full_access_team_ids()));
CREATE POLICY team_delete ON caashflow.bill_payments FOR DELETE
  USING (team_id IN (SELECT caashflow.user_full_access_team_ids()));
GRANT SELECT, INSERT, UPDATE, DELETE ON caashflow.bill_payments TO authenticated;

COMMIT;
