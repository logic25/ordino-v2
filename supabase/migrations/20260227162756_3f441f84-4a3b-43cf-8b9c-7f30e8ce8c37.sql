-- Fix #1: Scope emails to the owning user (not company-wide)
-- Drop the old company-wide SELECT policy
DROP POLICY IF EXISTS "Company isolation for emails" ON public.emails;

-- Users see only their own emails
CREATE POLICY "Users see own emails"
  ON public.emails FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  );

-- Admins/managers can also see all company emails  
CREATE POLICY "Admins see all company emails"
  ON public.emails FOR SELECT
  TO authenticated
  USING (
    is_admin_or_manager(company_id)
  );