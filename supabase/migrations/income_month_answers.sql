-- Answers for finished months with no income, keyed YYYY-MM:
-- not_tracked (left out of the stability score) or no_earnings (counts as $0).
alter table caashflow.settings
  add column if not exists income_month_answers jsonb not null default '{}'::jsonb;

comment on column caashflow.settings.income_month_answers is
  'Answers for finished months with no income, keyed YYYY-MM: not_tracked (left out of the stability score) or no_earnings (counts as $0).';

notify pgrst, 'reload schema';
