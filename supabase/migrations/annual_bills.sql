-- ============================================================
-- Migration: annual bills (theDailyStory caashflow schema)
--
-- Annual baseline items get a due month, how many months ahead to show them
-- (null = the default, 2), and an optional split over the months up to the due
-- month. A budget line carries which part of the split it is. Items with no due
-- month keep landing in every budget until one is set.
-- ============================================================

BEGIN;

ALTER TABLE caashflow.base_budget_items
  ADD COLUMN due_month SMALLINT CHECK (due_month BETWEEN 1 AND 12),
  ADD COLUMN remind_months SMALLINT CHECK (remind_months BETWEEN 0 AND 11),
  ADD COLUMN split_months SMALLINT CHECK (split_months BETWEEN 2 AND 12);

ALTER TABLE caashflow.period_expenses
  ADD COLUMN annual_part SMALLINT,
  ADD COLUMN annual_parts SMALLINT;

COMMIT;
