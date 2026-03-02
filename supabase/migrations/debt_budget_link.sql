-- ============================================================================
-- Debt ↔ Base Budget Item Link
-- Allows a debt record to be linked to a base_budget_item so that marking
-- a period expense as "paid" auto-logs the payment against the debt.
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add debt_id to base_budget_items (the source of truth for the link)
ALTER TABLE public.base_budget_items
  ADD COLUMN IF NOT EXISTS debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL;

-- Add debt_id to period_expenses (copied from base_budget_items at period creation)
ALTER TABLE public.period_expenses
  ADD COLUMN IF NOT EXISTS debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL;
