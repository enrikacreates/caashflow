-- ============================================================
-- CAASHFLOW Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- 1. TABLES
-- ============================================================

CREATE TABLE households (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT 'My Household',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE household_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(household_id, user_id)
);

CREATE TABLE settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE UNIQUE,
  tithe_percentage      NUMERIC(5,2) NOT NULL DEFAULT 10,
  savings_percentage    NUMERIC(5,2) NOT NULL DEFAULT 2,
  tax_percentage        NUMERIC(5,2) NOT NULL DEFAULT 25,
  profit_percentage     NUMERIC(5,2) NOT NULL DEFAULT 10,
  fun_money_percentage  NUMERIC(5,2) NOT NULL DEFAULT 2,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE base_budget_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  default_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  due_day           INTEGER CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31)),
  account           TEXT,
  priority_category TEXT,
  frequency         TEXT NOT NULL DEFAULT 'Monthly' CHECK (frequency IN ('Monthly', 'Weekly', 'Annually', 'One-Time')),
  auto_pay          BOOLEAN NOT NULL DEFAULT false,
  pay_url           TEXT,
  notes             TEXT,
  tags              TEXT[] DEFAULT '{}',
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE budget_periods (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  period_name         TEXT NOT NULL,
  income_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  deduction_overrides JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE period_expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id         UUID NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  household_id      UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  base_item_id      UUID REFERENCES base_budget_items(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  default_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  due_day           INTEGER,
  account           TEXT,
  priority_category TEXT,
  frequency         TEXT NOT NULL DEFAULT 'Monthly',
  auto_pay          BOOLEAN NOT NULL DEFAULT false,
  pay_url           TEXT,
  notes             TEXT,
  tags              TEXT[] DEFAULT '{}',
  pay_now           BOOLEAN NOT NULL DEFAULT false,
  transferred       BOOLEAN NOT NULL DEFAULT false,
  paid              BOOLEAN NOT NULL DEFAULT false,
  cleared           BOOLEAN NOT NULL DEFAULT false,
  amount_override   NUMERIC(10,2),
  override_notes    TEXT,
  is_partial        BOOLEAN NOT NULL DEFAULT false,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id         UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  client_name          TEXT NOT NULL,
  project_name         TEXT,
  amount               NUMERIC(10,2) NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'projected' CHECK (status IN ('projected', 'sent', 'received')),
  projected_date       DATE,
  actual_received_date DATE,
  month                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE period_linked_invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id   UUID NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  UNIQUE(period_id, invoice_id)
);

CREATE TABLE period_manual_income (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id     UUID NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  household_id  UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE budget_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  amount            NUMERIC(10,2) NOT NULL DEFAULT 0,
  priority_category TEXT DEFAULT 'P7: UpNext',
  status            TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'purchased')),
  tags              TEXT[] DEFAULT '{}',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- 2. INDEXES
-- ============================================================

CREATE INDEX idx_base_budget_items_household ON base_budget_items(household_id);
CREATE INDEX idx_budget_periods_household ON budget_periods(household_id);
CREATE INDEX idx_period_expenses_period ON period_expenses(period_id);
CREATE INDEX idx_period_expenses_household ON period_expenses(household_id);
CREATE INDEX idx_invoices_household ON invoices(household_id);
CREATE INDEX idx_budget_requests_household ON budget_requests(household_id);
CREATE INDEX idx_household_members_user ON household_members(user_id);
CREATE INDEX idx_household_members_household ON household_members(household_id);
CREATE INDEX idx_period_linked_invoices_period ON period_linked_invoices(period_id);
CREATE INDEX idx_period_manual_income_period ON period_manual_income(period_id);


-- 3. RLS HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_household_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT household_id
  FROM household_members
  WHERE user_id = auth.uid()
$$;


-- 4. ROW LEVEL SECURITY
-- ============================================================

-- households
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own households" ON households FOR SELECT
  USING (id IN (SELECT get_user_household_ids()));
CREATE POLICY "Authenticated users can create households" ON households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own households" ON households FOR UPDATE
  USING (id IN (SELECT get_user_household_ids()));

-- household_members
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own household members" ON household_members FOR SELECT
  USING (household_id IN (SELECT get_user_household_ids()) OR user_id = auth.uid());
CREATE POLICY "Users can insert own membership" ON household_members FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own membership" ON household_members FOR DELETE
  USING (user_id = auth.uid());

-- settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own settings" ON settings FOR SELECT
  USING (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can insert own settings" ON settings FOR INSERT
  WITH CHECK (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can update own settings" ON settings FOR UPDATE
  USING (household_id IN (SELECT get_user_household_ids()));

-- base_budget_items
ALTER TABLE base_budget_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own base budget" ON base_budget_items FOR SELECT
  USING (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can insert own base budget" ON base_budget_items FOR INSERT
  WITH CHECK (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can update own base budget" ON base_budget_items FOR UPDATE
  USING (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can delete own base budget" ON base_budget_items FOR DELETE
  USING (household_id IN (SELECT get_user_household_ids()));

-- budget_periods
ALTER TABLE budget_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own periods" ON budget_periods FOR SELECT
  USING (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can insert own periods" ON budget_periods FOR INSERT
  WITH CHECK (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can update own periods" ON budget_periods FOR UPDATE
  USING (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can delete own periods" ON budget_periods FOR DELETE
  USING (household_id IN (SELECT get_user_household_ids()));

-- period_expenses
ALTER TABLE period_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own period expenses" ON period_expenses FOR SELECT
  USING (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can insert own period expenses" ON period_expenses FOR INSERT
  WITH CHECK (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can update own period expenses" ON period_expenses FOR UPDATE
  USING (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can delete own period expenses" ON period_expenses FOR DELETE
  USING (household_id IN (SELECT get_user_household_ids()));

-- invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own invoices" ON invoices FOR SELECT
  USING (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can insert own invoices" ON invoices FOR INSERT
  WITH CHECK (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can update own invoices" ON invoices FOR UPDATE
  USING (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can delete own invoices" ON invoices FOR DELETE
  USING (household_id IN (SELECT get_user_household_ids()));

-- period_linked_invoices
ALTER TABLE period_linked_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own linked invoices" ON period_linked_invoices FOR SELECT
  USING (period_id IN (SELECT id FROM budget_periods WHERE household_id IN (SELECT get_user_household_ids())));
CREATE POLICY "Users can insert own linked invoices" ON period_linked_invoices FOR INSERT
  WITH CHECK (period_id IN (SELECT id FROM budget_periods WHERE household_id IN (SELECT get_user_household_ids())));
CREATE POLICY "Users can delete own linked invoices" ON period_linked_invoices FOR DELETE
  USING (period_id IN (SELECT id FROM budget_periods WHERE household_id IN (SELECT get_user_household_ids())));

-- period_manual_income
ALTER TABLE period_manual_income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own manual income" ON period_manual_income FOR SELECT
  USING (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can insert own manual income" ON period_manual_income FOR INSERT
  WITH CHECK (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can delete own manual income" ON period_manual_income FOR DELETE
  USING (household_id IN (SELECT get_user_household_ids()));

-- budget_requests
ALTER TABLE budget_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own requests" ON budget_requests FOR SELECT
  USING (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can insert own requests" ON budget_requests FOR INSERT
  WITH CHECK (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can update own requests" ON budget_requests FOR UPDATE
  USING (household_id IN (SELECT get_user_household_ids()));
CREATE POLICY "Users can delete own requests" ON budget_requests FOR DELETE
  USING (household_id IN (SELECT get_user_household_ids()));


-- 5. AUTO-SETUP FUNCTION
-- Called after a new user signs up to create their household + defaults
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_household_id UUID;
BEGIN
  -- Create a new household
  INSERT INTO households (name) VALUES ('My Household')
  RETURNING id INTO new_household_id;

  -- Add user as owner
  INSERT INTO household_members (household_id, user_id, role)
  VALUES (new_household_id, NEW.id, 'owner');

  -- Create default settings
  INSERT INTO settings (household_id) VALUES (new_household_id);

  RETURN NEW;
END;
$$;

-- Trigger: auto-create household on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
