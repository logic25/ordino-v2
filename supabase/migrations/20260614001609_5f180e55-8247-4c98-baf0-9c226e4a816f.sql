
-- 1. ai_usage_logs: prevent impersonation on INSERT
DROP POLICY IF EXISTS "Authenticated users can insert their company ai usage logs" ON public.ai_usage_logs;
CREATE POLICY "Authenticated users can insert their company ai usage logs"
  ON public.ai_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_company_member(company_id)
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

-- 2. telemetry_events: require company membership on INSERT
DROP POLICY IF EXISTS "Users can insert telemetry events" ON public.telemetry_events;
CREATE POLICY "Users can insert telemetry events"
  ON public.telemetry_events FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.get_user_company_id()
  );

-- 3. Storage: restrict RFI attachment uploads to authenticated users
DROP POLICY IF EXISTS "Upload RFI attachments to valid RFI folder" ON storage.objects;
CREATE POLICY "Upload RFI attachments to valid RFI folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'rfi-attachments'
    AND EXISTS (
      SELECT 1 FROM public.rfi_requests r
      WHERE r.id::text = (storage.foldername(objects.name))[1]
        AND r.status::text IN ('draft','sent','viewed','submitted')
    )
    AND lower(name) ~ '\.(pdf|png|jpg|jpeg|webp|gif|heic|heif|doc|docx|xls|xlsx|csv|txt)$'
  );

-- 4. gmail_connections: prevent client-side read of OAuth tokens
REVOKE SELECT (access_token, refresh_token) ON public.gmail_connections FROM authenticated, anon;
REVOKE UPDATE (access_token, refresh_token) ON public.gmail_connections FROM authenticated, anon;
REVOKE INSERT (access_token, refresh_token) ON public.gmail_connections FROM authenticated, anon;

-- 5. beacon_suggestions: tighten admin UPDATE to explicit app_role check and add admin SELECT
DROP POLICY IF EXISTS "admins review beacon suggestions" ON public.beacon_suggestions;
CREATE POLICY "Admins review beacon suggestions"
  ON public.beacon_suggestions FOR UPDATE
  TO authenticated
  USING (public.has_app_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_app_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read beacon suggestions" ON public.beacon_suggestions;
CREATE POLICY "Admins read beacon suggestions"
  ON public.beacon_suggestions FOR SELECT
  TO authenticated
  USING (public.has_app_role(auth.uid(), 'admin'));
