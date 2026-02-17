-- Allow public/anon to read properties linked to RFI requests
CREATE POLICY "Public can view properties linked to rfi_requests"
  ON public.properties FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rfi_requests
      WHERE rfi_requests.property_id = properties.id
        AND rfi_requests.status IN ('draft', 'sent')
    )
  );

-- Allow public/anon to read limited project data linked to RFI requests
CREATE POLICY "Public can view projects linked to rfi_requests"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rfi_requests
      WHERE rfi_requests.project_id = projects.id
        AND rfi_requests.status IN ('draft', 'sent')
    )
  );