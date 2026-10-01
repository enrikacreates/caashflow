-- ============================================================
-- Migration: Budget sessions (applied to theDailyStory caashflow schema)
--
-- A budget month is worked in sessions: each time money lands, you open a
-- session, add that income, and fund bills from it. Sessions are the tabs
-- on the budget page ("Aug 15: S2" / "Aug 15: Payday"); the Month tab
-- reconciles all of them.
--
--   • budget_sessions — one row per session (seq 1..n per budget)
--   • session_id on income, funded bills/installments, adjustments,
--     account-transfer checkmarks, and the legacy deduction ledger
--   • per-income deductions: income_type + skip_deductions on each income row
--   • triggers: every new budget gets S1; checking Pay attaches the bill to
--     the budget's newest session, unchecking an unpaid bill returns it to
--     the month's unfunded pool
--
-- Additive only. Existing budgets get a single S1 holding everything.
-- ============================================================

BEGIN;

-- ── 1. Sessions ────────────────────────────────────────────────
CREATE TABLE caashflow.budget_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id             UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  period_id           UUID NOT NULL REFERENCES caashflow.budget_periods(id) ON DELETE CASCADE,
  seq                 INTEGER NOT NULL,
  -- null → shown as "S{seq}"
  name                TEXT,
  session_date        DATE NOT NULL DEFAULT current_date,
  deduction_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  deduction_paid      JSONB NOT NULL DEFAULT '{}'::jsonb,
  deduction_cash      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_id, seq)
);
CREATE INDEX idx_budget_sessions_period ON caashflow.budget_sessions(period_id);

ALTER TABLE caashflow.budget_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_select ON caashflow.budget_sessions FOR SELECT
  USING (team_id IN (SELECT caashflow.user_team_ids()));
CREATE POLICY team_insert ON caashflow.budget_sessions FOR INSERT
  WITH CHECK (team_id IN (SELECT caashflow.user_full_access_team_ids()));
CREATE POLICY team_update ON caashflow.budget_sessions FOR UPDATE
  USING (team_id IN (SELECT caashflow.user_full_access_team_ids()))
  WITH CHECK (team_id IN (SELECT caashflow.user_full_access_team_ids()));
CREATE POLICY team_delete ON caashflow.budget_sessions FOR DELETE
  USING (team_id IN (SELECT caashflow.user_full_access_team_ids()));
GRANT SELECT, INSERT, UPDATE, DELETE ON caashflow.budget_sessions TO authenticated;


-- ── 2. session_id columns ──────────────────────────────────────
-- ON DELETE SET NULL: deleting a session returns its bills to the unfunded
-- pool; income/adjustments are reassigned by the app before delete.
ALTER TABLE caashflow.period_expenses
  ADD COLUMN session_id UUID REFERENCES caashflow.budget_sessions(id) ON DELETE SET NULL;
ALTER TABLE caashflow.period_expense_payments
  ADD COLUMN session_id UUID REFERENCES caashflow.budget_sessions(id) ON DELETE SET NULL;
ALTER TABLE caashflow.period_manual_income
  ADD COLUMN session_id UUID REFERENCES caashflow.budget_sessions(id) ON DELETE SET NULL;
ALTER TABLE caashflow.period_linked_invoices
  ADD COLUMN session_id UUID REFERENCES caashflow.budget_sessions(id) ON DELETE SET NULL;
ALTER TABLE caashflow.period_adjustments
  ADD COLUMN session_id UUID REFERENCES caashflow.budget_sessions(id) ON DELETE SET NULL;
ALTER TABLE caashflow.period_account_transfers
  ADD COLUMN session_id UUID REFERENCES caashflow.budget_sessions(id) ON DELETE CASCADE;
ALTER TABLE caashflow.period_deduction_contributions
  ADD COLUMN session_id UUID REFERENCES caashflow.budget_sessions(id) ON DELETE SET NULL;

CREATE INDEX idx_period_expenses_session          ON caashflow.period_expenses(session_id);
CREATE INDEX idx_period_expense_payments_session  ON caashflow.period_expense_payments(session_id);
CREATE INDEX idx_period_manual_income_session     ON caashflow.period_manual_income(session_id);
CREATE INDEX idx_period_linked_invoices_session   ON caashflow.period_linked_invoices(session_id);
CREATE INDEX idx_period_adjustments_session       ON caashflow.period_adjustments(session_id);

-- Transfer checkmarks are per session now (each session moves its own money)
ALTER TABLE caashflow.period_account_transfers
  DROP CONSTRAINT period_account_transfers_period_id_account_name_key;
ALTER TABLE caashflow.period_account_transfers
  ADD CONSTRAINT period_account_transfers_session_account_key UNIQUE (session_id, account_name);


-- ── 3. Per-income deductions ───────────────────────────────────
-- income_type: paycheck (deductions on, counts as income) | gift | refund
-- skip_deductions: keys this income skips — tithe|savings|tax|profit|fun_money
ALTER TABLE caashflow.period_manual_income
  ADD COLUMN income_type TEXT NOT NULL DEFAULT 'paycheck'
    CHECK (income_type IN ('paycheck', 'gift', 'refund')),
  ADD COLUMN skip_deductions TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE caashflow.period_linked_invoices
  ADD COLUMN income_type TEXT NOT NULL DEFAULT 'paycheck'
    CHECK (income_type IN ('paycheck', 'gift', 'refund')),
  ADD COLUMN skip_deductions TEXT[] NOT NULL DEFAULT '{}';


-- ── 4. Backfill: every budget gets S1 holding everything ───────
INSERT INTO caashflow.budget_sessions
  (team_id, period_id, seq, session_date, deduction_overrides, deduction_paid, deduction_cash, created_at)
SELECT p.team_id, p.id, 1,
       COALESCE(p.period_month, p.created_at::date),
       COALESCE(p.deduction_overrides, '{}'::jsonb),
       COALESCE(p.deduction_paid, '{}'::jsonb),
       COALESCE(p.deduction_cash, '{}'::jsonb),
       p.created_at
FROM caashflow.budget_periods p;

UPDATE caashflow.period_manual_income x SET session_id = s.id
FROM caashflow.budget_sessions s WHERE s.period_id = x.period_id;
UPDATE caashflow.period_linked_invoices x SET session_id = s.id
FROM caashflow.budget_sessions s WHERE s.period_id = x.period_id;
UPDATE caashflow.period_adjustments x SET session_id = s.id
FROM caashflow.budget_sessions s WHERE s.period_id = x.period_id;
UPDATE caashflow.period_account_transfers x SET session_id = s.id
FROM caashflow.budget_sessions s WHERE s.period_id = x.period_id;
UPDATE caashflow.period_deduction_contributions x SET session_id = s.id
FROM caashflow.budget_sessions s WHERE s.period_id = x.period_id;

-- Bills already committed (to pay, paid, or cleared) were funded by S1
UPDATE caashflow.period_expenses x SET session_id = s.id
FROM caashflow.budget_sessions s
WHERE s.period_id = x.period_id
  AND (x.pay_now OR x.paid OR x.cleared OR x.is_complete);
UPDATE caashflow.period_expense_payments x SET session_id = s.id
FROM caashflow.period_expenses e, caashflow.budget_sessions s
WHERE e.id = x.period_expense_id AND s.period_id = e.period_id
  AND (x.pay_now OR x.paid OR x.cleared);

-- Existing gift-style manual income ("Not income") skips deductions going forward
UPDATE caashflow.period_manual_income
SET income_type = 'gift', skip_deductions = ARRAY['tithe','savings','tax','profit','fun_money']
WHERE exclude_from_reports;

-- Event budgets that never opted into deductions: their income skips them
UPDATE caashflow.period_manual_income mi
SET skip_deductions = ARRAY['tithe','savings','tax','profit','fun_money']
FROM caashflow.budget_periods p
WHERE p.id = mi.period_id AND p.kind = 'event' AND NOT COALESCE(p.apply_deductions, false);
UPDATE caashflow.period_linked_invoices li
SET skip_deductions = ARRAY['tithe','savings','tax','profit','fun_money']
FROM caashflow.budget_periods p
WHERE p.id = li.period_id AND p.kind = 'event' AND NOT COALESCE(p.apply_deductions, false);


-- ── 5. Triggers ────────────────────────────────────────────────
-- New budgets start with S1
CREATE OR REPLACE FUNCTION caashflow.create_first_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = caashflow, public AS $$
BEGIN
  INSERT INTO caashflow.budget_sessions (team_id, period_id, seq, session_date)
  VALUES (NEW.team_id, NEW.id, 1, current_date);
  RETURN NEW;
END;
$$;
CREATE TRIGGER budget_periods_first_session
  AFTER INSERT ON caashflow.budget_periods
  FOR EACH ROW EXECUTE FUNCTION caashflow.create_first_session();

CREATE OR REPLACE FUNCTION caashflow.current_session_id(p_period_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = caashflow, public AS $$
  SELECT id FROM caashflow.budget_sessions WHERE period_id = p_period_id ORDER BY seq DESC LIMIT 1
$$;

-- Pay checked → funded by the newest session (unless the app already chose one).
-- Pay unchecked on a bill that isn't paid/cleared → back to the unfunded pool.
CREATE OR REPLACE FUNCTION caashflow.expense_session_on_pay()
RETURNS trigger LANGUAGE plpgsql SET search_path = caashflow, public AS $$
BEGIN
  IF NEW.pay_now AND NEW.session_id IS NULL THEN
    NEW.session_id := caashflow.current_session_id(NEW.period_id);
  ELSIF NOT NEW.pay_now AND NOT NEW.paid AND NOT NEW.cleared AND NOT NEW.is_complete
        AND NOT NEW.is_split THEN
    NEW.session_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER period_expenses_session_on_pay
  BEFORE INSERT OR UPDATE OF pay_now, paid, cleared, is_complete ON caashflow.period_expenses
  FOR EACH ROW EXECUTE FUNCTION caashflow.expense_session_on_pay();

CREATE OR REPLACE FUNCTION caashflow.payment_session_on_pay()
RETURNS trigger LANGUAGE plpgsql SET search_path = caashflow, public AS $$
BEGIN
  IF NEW.pay_now AND NEW.session_id IS NULL THEN
    NEW.session_id := caashflow.current_session_id(
      (SELECT period_id FROM caashflow.period_expenses WHERE id = NEW.period_expense_id));
  ELSIF NOT NEW.pay_now AND NOT NEW.paid AND NOT NEW.cleared THEN
    NEW.session_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER period_expense_payments_session_on_pay
  BEFORE INSERT OR UPDATE OF pay_now, paid, cleared ON caashflow.period_expense_payments
  FOR EACH ROW EXECUTE FUNCTION caashflow.payment_session_on_pay();

COMMIT;
