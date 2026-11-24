-- ============================================================
-- Migration: !! priority, House Rules (theDailyStory caashflow schema)
--
-- period_expenses.urgent: the !! flag. It lives on the month's line, so it never
-- carries into next month's budget, and the app stops honoring it once the line
-- is settled.
-- house_rules: the family's short, ordered list shown under the menu. Seeded with
-- the defaults the first time a team loads it (settings.house_rules_seeded), so
-- deleting every rule doesn't bring the defaults back.
-- ============================================================

BEGIN;

ALTER TABLE caashflow.period_expenses
  ADD COLUMN IF NOT EXISTS urgent BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE caashflow.settings
  ADD COLUMN IF NOT EXISTS house_rules_seeded BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS caashflow.house_rules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  text       TEXT NOT NULL CHECK (length(trim(text)) > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_house_rules_team ON caashflow.house_rules(team_id, sort_order);

ALTER TABLE caashflow.house_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_select ON caashflow.house_rules FOR SELECT
  USING (team_id IN (SELECT caashflow.user_team_ids()));
CREATE POLICY team_insert ON caashflow.house_rules FOR INSERT
  WITH CHECK (team_id IN (SELECT caashflow.user_full_access_team_ids()));
CREATE POLICY team_update ON caashflow.house_rules FOR UPDATE
  USING (team_id IN (SELECT caashflow.user_full_access_team_ids()))
  WITH CHECK (team_id IN (SELECT caashflow.user_full_access_team_ids()));
CREATE POLICY team_delete ON caashflow.house_rules FOR DELETE
  USING (team_id IN (SELECT caashflow.user_full_access_team_ids()));
GRANT SELECT, INSERT, UPDATE, DELETE ON caashflow.house_rules TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
