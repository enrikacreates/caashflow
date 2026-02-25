-- ============================================================
-- Migration: Household Member Invite System
-- Paste this entire block into your Supabase SQL Editor and Run
-- ============================================================


-- ── 1. Add email column to household_members ────────────────
ALTER TABLE household_members
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill email from auth.users for any existing rows
UPDATE household_members hm
SET email = au.email
FROM auth.users au
WHERE hm.user_id = au.id
  AND hm.email IS NULL;


-- ── 2. Create household_invites table ───────────────────────
CREATE TABLE IF NOT EXISTS household_invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  token         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by    UUID REFERENCES auth.users(id),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);


-- ── 3. RLS on household_invites ──────────────────────────────
ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;

-- Public read (anon + authed): needed so the /join/[token] page
-- can validate an invite before the user is logged in.
-- The token is a UUID — effectively unguessable.
CREATE POLICY "Public can read invites by token"
  ON household_invites FOR SELECT
  USING (true);

-- Only authenticated household members can create invites
CREATE POLICY "Members can create invites"
  ON household_invites FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id
      FROM household_members
      WHERE user_id = auth.uid()
    )
  );

-- Only authenticated household members can update (expire) invites
CREATE POLICY "Members can update invites"
  ON household_invites FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id
      FROM household_members
      WHERE user_id = auth.uid()
    )
  );


-- ── 4. Update handle_new_user trigger ───────────────────────
-- This replaces your existing trigger function so it checks
-- for an invite_token in user metadata during signup.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_invite_token  TEXT;
  v_invite        RECORD;
  v_household_id  UUID;
BEGIN
  -- Check if a valid invite token was passed during signup
  v_invite_token := NEW.raw_user_meta_data->>'invite_token';

  IF v_invite_token IS NOT NULL THEN
    -- Find a valid, non-expired, pending invite with this token
    SELECT *
    INTO v_invite
    FROM household_invites
    WHERE token = v_invite_token::UUID
      AND status = 'pending'
      AND expires_at > now()
    LIMIT 1;

    IF FOUND THEN
      -- Add user to the existing household as a member
      INSERT INTO household_members (household_id, user_id, role, email)
      VALUES (v_invite.household_id, NEW.id, 'member', NEW.email);

      -- Mark the invite as accepted so it can't be reused
      UPDATE household_invites
      SET status = 'accepted'
      WHERE id = v_invite.id;

      RETURN NEW;
    END IF;
    -- If invite not found / expired, fall through and create a new household
  END IF;

  -- ── Default flow: new standalone user ───────────────────
  INSERT INTO households (name)
  VALUES ('My Household')
  RETURNING id INTO v_household_id;

  INSERT INTO household_members (household_id, user_id, role, email)
  VALUES (v_household_id, NEW.id, 'owner', NEW.email);

  INSERT INTO settings (
    household_id,
    tithe_percentage,
    savings_percentage,
    tax_percentage,
    profit_percentage,
    fun_money_percentage
  ) VALUES (
    v_household_id,
    10, 2, 25, 10, 2
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure the trigger is attached (safe to run even if already exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
