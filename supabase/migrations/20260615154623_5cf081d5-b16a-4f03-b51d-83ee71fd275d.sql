
-- Tighten beacon_suggestions admin policies to require the admin to be an admin
-- in their own company (was: any admin role across any company).
DROP POLICY IF EXISTS "Admins read beacon suggestions" ON public.beacon_suggestions;
DROP POLICY IF EXISTS "Admins review beacon suggestions" ON public.beacon_suggestions;

CREATE POLICY "Admins read beacon suggestions"
  ON public.beacon_suggestions FOR SELECT TO authenticated
  USING (public.is_company_admin(public.get_user_company_id()));

CREATE POLICY "Admins review beacon suggestions"
  ON public.beacon_suggestions FOR UPDATE TO authenticated
  USING (public.is_company_admin(public.get_user_company_id()))
  WITH CHECK (public.is_company_admin(public.get_user_company_id()));
