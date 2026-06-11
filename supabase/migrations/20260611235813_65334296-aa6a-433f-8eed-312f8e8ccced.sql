CREATE POLICY "Admins can update company profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_company_admin(company_id))
WITH CHECK (is_company_admin(company_id));