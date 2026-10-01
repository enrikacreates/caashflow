-- ============================================================
-- Migration: Caashflow household → unified team (shared theDailyStory DB)
--
-- Scoped to caashflow only. Deliberately does NOT:
--   - touch other app schemas' RLS helpers (signature_style, storykeepr, ...)
--   - drop any trigger on auth.users (on_auth_user_created is shared)
--   - drop anything in the public schema
--
-- What this does:
--   1. Adds the shared team-access pieces caashflow needs
--      (public.team_app_access + public.user_*_team_ids(app) helpers)
--   2. Re-keys caashflow data from the household onto the owner's
--      existing public.teams row (one team per person across apps),
--      carrying the household slug over for the public request link
--   3. Renames household_id → team_id on every caashflow table,
--      FKs → public.teams, rebuilds RLS on the new helpers
--   4. Drops the caashflow household tables
--   5. Replaces household RPCs with team RPCs
-- ============================================================

BEGIN;

-- ── 1. Shared team access (new objects only) ───────────────────
CREATE TABLE IF NOT EXISTS public.team_app_access (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  app_schema TEXT NOT NULL,
  access     TEXT NOT NULL DEFAULT 'full' CHECK (access IN ('full', 'read')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, app_schema)
);
ALTER TABLE public.team_app_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members can view app access" ON public.team_app_access;
CREATE POLICY "Team members can view app access" ON public.team_app_access FOR SELECT
  USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Team owners can insert app access" ON public.team_app_access;
CREATE POLICY "Team owners can insert app access" ON public.team_app_access FOR INSERT
  WITH CHECK (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role = 'owner'));
DROP POLICY IF EXISTS "Team owners can update app access" ON public.team_app_access;
CREATE POLICY "Team owners can update app access" ON public.team_app_access FOR UPDATE
  USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role = 'owner'));
DROP POLICY IF EXISTS "Team owners can delete app access" ON public.team_app_access;
CREATE POLICY "Team owners can delete app access" ON public.team_app_access FOR DELETE
  USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role = 'owner'));

CREATE INDEX IF NOT EXISTS idx_team_app_access_member ON public.team_app_access(member_id);
CREATE INDEX IF NOT EXISTS idx_team_app_access_team   ON public.team_app_access(team_id);

-- Owner always passes; members need an explicit grant row for the app.
CREATE OR REPLACE FUNCTION public.user_accessible_team_ids(p_app_schema TEXT)
RETURNS SETOF UUID LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT tm.team_id FROM public.team_members tm
  WHERE tm.user_id = auth.uid()
    AND (tm.role = 'owner' OR EXISTS (
      SELECT 1 FROM public.team_app_access taa
      WHERE taa.member_id = tm.id AND taa.app_schema = p_app_schema
        AND taa.access IN ('full', 'read')))
$$;

CREATE OR REPLACE FUNCTION public.user_full_access_team_ids(p_app_schema TEXT)
RETURNS SETOF UUID LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT tm.team_id FROM public.team_members tm
  WHERE tm.user_id = auth.uid()
    AND (tm.role = 'owner' OR EXISTS (
      SELECT 1 FROM public.team_app_access taa
      WHERE taa.member_id = tm.id AND taa.app_schema = p_app_schema
        AND taa.access = 'full'))
$$;

CREATE OR REPLACE FUNCTION caashflow.user_team_ids()
RETURNS SETOF UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.user_accessible_team_ids('caashflow')
$$;

CREATE OR REPLACE FUNCTION caashflow.user_full_access_team_ids()
RETURNS SETOF UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.user_full_access_team_ids('caashflow')
$$;


-- ── 2. Map each household → a team ─────────────────────────────
-- Owner's existing team if they have one; otherwise the household
-- becomes a new team with the same UUID.
CREATE TEMP TABLE hh_map ON COMMIT DROP AS
SELECT h.id AS household_id,
       COALESCE(
         (SELECT tm.team_id FROM public.team_members tm
          JOIN caashflow.household_members hm ON hm.user_id = tm.user_id
          WHERE hm.household_id = h.id AND hm.role = 'owner'
          ORDER BY tm.created_at LIMIT 1),
         h.id) AS team_id,
       h.name, h.slug, h.created_at
FROM caashflow.households h;

INSERT INTO public.teams (id, name, slug, created_at, updated_at)
SELECT m.team_id, m.name, m.slug, m.created_at, now()
FROM hh_map m WHERE m.team_id = m.household_id
ON CONFLICT (id) DO NOTHING;

-- Carry the public-request slug over if the team doesn't have one yet
UPDATE public.teams t SET slug = m.slug, updated_at = now()
FROM hh_map m
WHERE t.id = m.team_id AND t.slug IS NULL AND m.slug IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.teams x WHERE x.slug = m.slug);

INSERT INTO public.team_members (team_id, user_id, role, email, created_at)
SELECT m.team_id, hm.user_id, hm.role, hm.email, hm.created_at
FROM caashflow.household_members hm JOIN hh_map m ON m.household_id = hm.household_id
WHERE NOT EXISTS (SELECT 1 FROM public.team_members tm
                  WHERE tm.team_id = m.team_id AND tm.user_id = hm.user_id);

INSERT INTO public.team_invites (team_id, token, invited_by, status, created_at, expires_at)
SELECT m.team_id, hi.token, hi.invited_by, hi.status, hi.created_at, hi.expires_at
FROM caashflow.household_invites hi JOIN hh_map m ON m.household_id = hi.household_id
ON CONFLICT (token) DO NOTHING;


-- ── 3. household_id → team_id on every caashflow table ─────────
DO $$
DECLARE
  t    TEXT;
  pol  RECORD;
  tbls TEXT[] := ARRAY[
    'settings', 'base_budget_items', 'budget_periods', 'period_expenses',
    'invoices', 'period_manual_income', 'budget_requests', 'debts',
    'savings_goals', 'accounts', 'priority_categories',
    'period_savings_allocations', 'period_expense_payments',
    'period_deduction_contributions', 'period_adjustments',
    'period_expense_adjustments', 'savings_goal_adjustments',
    'period_account_transfers', 'period_expense_transfers'];
BEGIN
  FOREACH t IN ARRAY tbls || ARRAY['period_linked_invoices'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies
               WHERE schemaname = 'caashflow' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON caashflow.%I', pol.policyname, t);
    END LOOP;
  END LOOP;

  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE caashflow.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_household_id_fkey');
    EXECUTE format('ALTER TABLE caashflow.%I RENAME COLUMN household_id TO team_id', t);
    EXECUTE format('UPDATE caashflow.%I x SET team_id = m.team_id FROM hh_map m
                    WHERE x.team_id = m.household_id AND m.team_id <> m.household_id', t);
    EXECUTE format('ALTER TABLE caashflow.%I ADD CONSTRAINT %I
                    FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE', t, t || '_team_id_fkey');

    EXECUTE format('CREATE POLICY team_select ON caashflow.%I FOR SELECT
                    USING (team_id IN (SELECT caashflow.user_team_ids()))', t);
    EXECUTE format('CREATE POLICY team_insert ON caashflow.%I FOR INSERT
                    WITH CHECK (team_id IN (SELECT caashflow.user_full_access_team_ids()))', t);
    EXECUTE format('CREATE POLICY team_update ON caashflow.%I FOR UPDATE
                    USING (team_id IN (SELECT caashflow.user_full_access_team_ids()))
                    WITH CHECK (team_id IN (SELECT caashflow.user_full_access_team_ids()))', t);
    EXECUTE format('CREATE POLICY team_delete ON caashflow.%I FOR DELETE
                    USING (team_id IN (SELECT caashflow.user_full_access_team_ids()))', t);
  END LOOP;
END $$;

-- period_linked_invoices has no team_id; scoped through its period
CREATE POLICY team_select ON caashflow.period_linked_invoices FOR SELECT
  USING (period_id IN (SELECT id FROM caashflow.budget_periods WHERE team_id IN (SELECT caashflow.user_team_ids())));
CREATE POLICY team_insert ON caashflow.period_linked_invoices FOR INSERT
  WITH CHECK (period_id IN (SELECT id FROM caashflow.budget_periods WHERE team_id IN (SELECT caashflow.user_full_access_team_ids())));
CREATE POLICY team_update ON caashflow.period_linked_invoices FOR UPDATE
  USING (period_id IN (SELECT id FROM caashflow.budget_periods WHERE team_id IN (SELECT caashflow.user_full_access_team_ids())))
  WITH CHECK (period_id IN (SELECT id FROM caashflow.budget_periods WHERE team_id IN (SELECT caashflow.user_full_access_team_ids())));
CREATE POLICY team_delete ON caashflow.period_linked_invoices FOR DELETE
  USING (period_id IN (SELECT id FROM caashflow.budget_periods WHERE team_id IN (SELECT caashflow.user_full_access_team_ids())));

ALTER INDEX IF EXISTS caashflow.settings_household_id_key                 RENAME TO settings_team_id_key;
ALTER INDEX IF EXISTS caashflow.idx_caashflow_base_budget_items_household RENAME TO idx_caashflow_base_budget_items_team;
ALTER INDEX IF EXISTS caashflow.idx_caashflow_invoices_household          RENAME TO idx_caashflow_invoices_team;
ALTER INDEX IF EXISTS caashflow.idx_caashflow_budget_requests_household   RENAME TO idx_caashflow_budget_requests_team;
ALTER INDEX IF EXISTS caashflow.idx_caashflow_period_expenses_household   RENAME TO idx_caashflow_period_expenses_team;
ALTER INDEX IF EXISTS caashflow.idx_caashflow_budget_periods_household    RENAME TO idx_caashflow_budget_periods_team;
ALTER INDEX IF EXISTS caashflow.period_expense_adjustments_household_idx  RENAME TO period_expense_adjustments_team_idx;


-- ── 4. Drop caashflow household tables ─────────────────────────
-- (before the old helper fn, whose policies live on these tables)
DROP TABLE caashflow.household_invites;
DROP TABLE caashflow.household_members;
DROP TABLE caashflow.households;


-- ── 5. RPCs ────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS caashflow.get_user_household_ids();
DROP FUNCTION IF EXISTS caashflow.provision_household_for_current_user();
DROP FUNCTION IF EXISTS caashflow.get_public_household(TEXT);

-- Reuses the user's existing team (from any app) or creates one.
CREATE OR REPLACE FUNCTION caashflow.provision_team_for_current_user()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = caashflow, public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_team_id UUID;
  v_email   TEXT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Prevents double-provisioning on concurrent first visits
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::TEXT));

  SELECT team_id INTO v_team_id FROM public.team_members
  WHERE user_id = v_user_id ORDER BY created_at LIMIT 1;

  IF v_team_id IS NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    INSERT INTO public.teams (name) VALUES ('My Household') RETURNING id INTO v_team_id;
    INSERT INTO public.team_members (team_id, user_id, role, email)
    VALUES (v_team_id, v_user_id, 'owner', v_email);
  END IF;

  INSERT INTO caashflow.settings (team_id) VALUES (v_team_id)
  ON CONFLICT (team_id) DO NOTHING;
  RETURN v_team_id;
END;
$$;

CREATE OR REPLACE FUNCTION caashflow.get_public_team(p_slug TEXT)
RETURNS TABLE(id UUID, name TEXT) LANGUAGE sql SECURITY DEFINER SET search_path = caashflow, public AS $$
  SELECT t.id, t.name FROM public.teams t WHERE t.slug = lower(p_slug) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION caashflow.submit_public_request(
  p_slug TEXT, p_name TEXT, p_amount NUMERIC, p_requested_for TEXT,
  p_image_url TEXT, p_notes TEXT, p_url TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = caashflow, public AS $$
DECLARE tid UUID;
BEGIN
  SELECT id INTO tid FROM public.teams WHERE slug = lower(p_slug) LIMIT 1;
  IF tid IS NULL THEN RAISE EXCEPTION 'Unknown family'; END IF;
  IF coalesce(btrim(p_name), '') = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  INSERT INTO caashflow.budget_requests
    (team_id, name, amount, requested_for, image_url, notes, url, status, priority_category)
  VALUES
    (tid, left(btrim(p_name), 200), coalesce(p_amount, 0),
     nullif(btrim(p_requested_for), ''), nullif(btrim(p_image_url), ''), nullif(btrim(p_notes), ''),
     nullif(btrim(p_url), ''), 'requested', 'P7: UpNext');
END;
$$;

GRANT EXECUTE ON FUNCTION caashflow.provision_team_for_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION caashflow.get_public_team(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION caashflow.submit_public_request(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;


COMMIT;
