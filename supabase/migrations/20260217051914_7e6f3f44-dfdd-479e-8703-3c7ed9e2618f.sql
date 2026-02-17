
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pis_tracking' AND policyname = 'Anon can fulfill pis_tracking via public token') THEN
    EXECUTE 'CREATE POLICY "Anon can fulfill pis_tracking via public token" ON public.pis_tracking FOR UPDATE USING (EXISTS (SELECT 1 FROM public.rfi_requests r WHERE r.id = pis_tracking.rfi_request_id AND r.access_token IS NOT NULL)) WITH CHECK (EXISTS (SELECT 1 FROM public.rfi_requests r WHERE r.id = pis_tracking.rfi_request_id AND r.access_token IS NOT NULL))';
  END IF;
END $$;
