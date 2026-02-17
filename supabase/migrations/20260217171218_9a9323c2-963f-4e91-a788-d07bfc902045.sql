-- Allow public read of clients linked to rfi_requests (via projects)
CREATE POLICY "Public can view clients linked to rfi_requests"
  ON public.clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN rfi_requests rr ON rr.project_id = p.id
      WHERE p.client_id = clients.id
        AND rr.status IN ('draft', 'sent')
    )
  );
