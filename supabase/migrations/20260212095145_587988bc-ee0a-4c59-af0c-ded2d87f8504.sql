-- Allow anonymous users to read RFI requests by access token (for public form)
CREATE POLICY "Public can view rfi by access token"
  ON public.rfi_requests FOR SELECT
  USING (true);

-- Allow anonymous users to update RFI responses by access token
CREATE POLICY "Public can submit rfi responses by access token"
  ON public.rfi_requests FOR UPDATE
  USING (status IN ('draft', 'sent'))
  WITH CHECK (status IN ('draft', 'sent', 'submitted'));