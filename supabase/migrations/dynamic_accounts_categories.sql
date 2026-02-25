-- ============================================================================
-- Dynamic Accounts & Priority Categories
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Accounts table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own household accounts"
  ON public.accounts FOR ALL
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
    )
  );

-- 2. Priority Categories table
CREATE TABLE public.priority_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_key TEXT NOT NULL DEFAULT 'blue',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.priority_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own household categories"
  ON public.priority_categories FOR ALL
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
    )
  );

-- 3. Seed defaults for ALL existing households
INSERT INTO public.accounts (household_id, name, sort_order)
SELECT h.id, a.name, a.sort_order
FROM public.households h
CROSS JOIN (VALUES
  ('Opt X', 0),
  ('Owners Comp', 1),
  ('Personal Savings', 2)
) AS a(name, sort_order);

INSERT INTO public.priority_categories (household_id, name, color_key, sort_order)
SELECT h.id, c.name, c.color_key, c.sort_order
FROM public.households h
CROSS JOIN (VALUES
  ('P0: Lifeline', 'green', 0),
  ('P1: Essentials', 'blue', 1),
  ('P3: Debt', 'orange', 2),
  ('P4: Business | Education', 'muted', 3),
  ('P5: Lifestyle', 'rosy', 4),
  ('P7: UpNext', 'blush', 5)
) AS c(name, color_key, sort_order);

-- 4. Update handle_new_user() trigger to seed accounts + categories for new households
-- This adds seeding into the branch where a new household is created (no invite).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id UUID;
  v_invite RECORD;
BEGIN
  -- Check for a pending invite matching this email
  SELECT * INTO v_invite
  FROM public.household_invites
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite IS NOT NULL THEN
    -- Join existing household via invite
    INSERT INTO public.household_members (household_id, user_id, role, email)
    VALUES (v_invite.household_id, NEW.id, 'member', NEW.email);

    UPDATE public.household_invites
    SET status = 'accepted'
    WHERE id = v_invite.id;
  ELSE
    -- Create a new household + settings + membership
    INSERT INTO public.households (name)
    VALUES (split_part(NEW.email, '@', 1) || '''s Household')
    RETURNING id INTO v_household_id;

    INSERT INTO public.household_members (household_id, user_id, role, email)
    VALUES (v_household_id, NEW.id, 'owner', NEW.email);

    INSERT INTO public.settings (household_id)
    VALUES (v_household_id);

    -- Seed default accounts
    INSERT INTO public.accounts (household_id, name, sort_order) VALUES
      (v_household_id, 'Opt X', 0),
      (v_household_id, 'Owners Comp', 1),
      (v_household_id, 'Personal Savings', 2);

    -- Seed default priority categories
    INSERT INTO public.priority_categories (household_id, name, color_key, sort_order) VALUES
      (v_household_id, 'P0: Lifeline', 'green', 0),
      (v_household_id, 'P1: Essentials', 'blue', 1),
      (v_household_id, 'P3: Debt', 'orange', 2),
      (v_household_id, 'P4: Business | Education', 'muted', 3),
      (v_household_id, 'P5: Lifestyle', 'rosy', 4),
      (v_household_id, 'P7: UpNext', 'blush', 5);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
