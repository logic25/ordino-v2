DROP POLICY "Public can submit rfi responses by access token" ON public.rfi_requests;

CREATE POLICY "Public can submit rfi responses by access token"
ON public.rfi_requests
FOR UPDATE
USING (
  status IN ('draft', 'sent', 'submitted')
)
WITH CHECK (
  status IN ('draft', 'sent', 'submitted')
);