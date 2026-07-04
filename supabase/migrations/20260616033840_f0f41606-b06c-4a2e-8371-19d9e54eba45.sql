DROP POLICY IF EXISTS "Admins can manage user_monthly_goals" ON public.user_monthly_goals;

CREATE POLICY "Admins can manage user_monthly_goals"
ON public.user_monthly_goals
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));