DROP POLICY IF EXISTS "Admins can manage user_monthly_goals" ON public.user_monthly_goals;
DROP POLICY IF EXISTS "Company members can view user_monthly_goals" ON public.user_monthly_goals;

CREATE POLICY "Admins can manage user_monthly_goals"
ON public.user_monthly_goals
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role)
)
WITH CHECK (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role)
);

CREATE POLICY "Company members can view user_monthly_goals"
ON public.user_monthly_goals
FOR SELECT
TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
);