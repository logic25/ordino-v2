
-- Drop table-level INSERT/UPDATE that was overriding the column-level revoke,
-- then re-grant explicit non-role column lists.
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
REVOKE INSERT, UPDATE ON public.profiles FROM anon;

GRANT INSERT (
  id, user_id, company_id, first_name, last_name, display_name, phone, avatar_url,
  preferences, is_active, created_at, updated_at, phone_extension, signature_data,
  monthly_goal, about, carrier, job_title, notification_preferences,
  onboarding_completed, accuracy_goal, ooo_from, ooo_to, ooo_covering_pm_id,
  ooo_note, weekly_goal, is_comp_admin
) ON public.profiles TO authenticated;

GRANT UPDATE (
  id, user_id, company_id, first_name, last_name, display_name, phone, avatar_url,
  preferences, is_active, updated_at, phone_extension, signature_data,
  monthly_goal, about, carrier, job_title, notification_preferences,
  onboarding_completed, accuracy_goal, ooo_from, ooo_to, ooo_covering_pm_id,
  ooo_note, weekly_goal, is_comp_admin
) ON public.profiles TO authenticated;

-- Verification: role column should no longer appear for authenticated/anon
SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name='profiles' AND column_name='role'
  AND grantee IN ('authenticated','anon')
ORDER BY grantee, privilege_type;
