CREATE POLICY "Authenticated can view company via CO token"
ON public.companies
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT company_id FROM public.change_orders WHERE public_token IS NOT NULL
  )
  OR id IN (
    SELECT company_id FROM public.rfi_requests WHERE status IN ('draft', 'sent', 'viewed')
  )
  OR id IN (
    SELECT company_id FROM public.proposals WHERE public_token IS NOT NULL
  )
);