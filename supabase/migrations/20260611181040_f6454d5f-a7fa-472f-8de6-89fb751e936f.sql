
UPDATE public.profiles SET role = 'pm'::user_role
WHERE user_id IN (
  'e1bcbe20-06e4-448d-83e6-502dc4268ece',
  'ba281190-dcaa-4a6a-b3bc-c33a6a7e6e16',
  '7c8e2d9c-dc04-46f9-89c1-7336b2ad6504'
);
UPDATE public.profiles SET role = 'accounting'::user_role
WHERE user_id = '7bd47d95-39ac-4a44-bd10-2bad4bb8a289';

UPDATE public.user_roles SET role = 'pm'
WHERE user_id IN (
  'e1bcbe20-06e4-448d-83e6-502dc4268ece',
  'ba281190-dcaa-4a6a-b3bc-c33a6a7e6e16',
  '7c8e2d9c-dc04-46f9-89c1-7336b2ad6504'
);
UPDATE public.user_roles SET role = 'accounting'
WHERE user_id = '7bd47d95-39ac-4a44-bd10-2bad4bb8a289';

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS weekly_billing_goal_override NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_billing_goal_override NUMERIC;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_goal NUMERIC;

INSERT INTO public.changelog_entries (title, description, tag, created_by, company_id)
SELECT
  'Roles tuned + billing goals',
  'Production users re-tagged as PM; Sai moved to Accounting. New per-user weekly billing goal and company-wide weekly/monthly goal overrides available in Settings.',
  'improvement',
  p.id,
  p.company_id
FROM public.profiles p
WHERE p.user_id = '8efa54e0-8fad-41ae-a7d4-c89d96356634'
LIMIT 1;
