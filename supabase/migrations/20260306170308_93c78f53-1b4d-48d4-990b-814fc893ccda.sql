CREATE POLICY "Admins can delete feature_requests in their company"
ON public.feature_requests
FOR DELETE
TO authenticated
USING (is_company_member(company_id));