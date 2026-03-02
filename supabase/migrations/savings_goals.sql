-- Savings Goals table
CREATE TABLE public.savings_goals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id         UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  goal_type            TEXT NOT NULL CHECK (goal_type IN ('purchase', 'fund')),
  target_amount        NUMERIC(12,2) NOT NULL,
  current_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  monthly_contribution NUMERIC(12,2),
  target_date          DATE,
  notes                TEXT,
  is_achieved          BOOLEAN NOT NULL DEFAULT false,
  achieved_at          TIMESTAMPTZ,
  sort_order           INT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own household savings goals"
  ON public.savings_goals FOR ALL
  USING (household_id IN (
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
  ));

-- Link savings goals to budget items (same pattern as debt_id)
ALTER TABLE public.base_budget_items
  ADD COLUMN IF NOT EXISTS savings_goal_id UUID REFERENCES public.savings_goals(id) ON DELETE SET NULL;

ALTER TABLE public.period_expenses
  ADD COLUMN IF NOT EXISTS savings_goal_id UUID REFERENCES public.savings_goals(id) ON DELETE SET NULL;
