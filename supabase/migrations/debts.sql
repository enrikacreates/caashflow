-- ============================================================================
-- Debts (Debt Paydown tracking)
-- Run this in Supabase SQL Editor
-- ============================================================================

CREATE TABLE public.debts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id     UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  original_balance NUMERIC(12,2) NOT NULL,
  current_balance  NUMERIC(12,2) NOT NULL,
  interest_rate    NUMERIC(5,2),       -- APR %, optional
  minimum_payment  NUMERIC(12,2),      -- monthly minimum, optional
  due_day          INTEGER,            -- day of month (1–31), optional
  notes            TEXT,
  is_paid_off      BOOLEAN NOT NULL DEFAULT false,
  paid_off_at      TIMESTAMPTZ,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own household debts"
  ON public.debts FOR ALL
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
    )
  );
