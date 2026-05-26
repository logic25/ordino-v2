
-- 1) Drop unsafe public RFI policies on business tables
DROP POLICY IF EXISTS "Public can view clients linked to rfi_requests" ON public.clients;
DROP POLICY IF EXISTS "Public can view properties linked to rfi_requests" ON public.properties;
DROP POLICY IF EXISTS "Public can view projects linked to rfi_requests" ON public.projects;

-- 2) Tighten rfi-attachments upload policy: require path to start with a valid RFI id
DROP POLICY IF EXISTS "Anyone can upload RFI attachments" ON storage.objects;

CREATE POLICY "Upload RFI attachments to valid RFI folder"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'rfi-attachments'
  AND EXISTS (
    SELECT 1 FROM public.rfi_requests r
    WHERE r.id::text = (storage.foldername(name))[1]
      AND r.status IN ('draft', 'sent', 'viewed', 'submitted')
  )
);

-- 3) Add an authenticated-only RLS policy to realtime.messages so anon cannot subscribe
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can use realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);
