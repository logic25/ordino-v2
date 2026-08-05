CREATE TABLE public.beacon_kb_originals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  source_file TEXT NOT NULL,
  folder TEXT,
  storage_path TEXT NOT NULL,
  content_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, source_file)
);

CREATE INDEX idx_beacon_kb_originals_source_file ON public.beacon_kb_originals (source_file);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.beacon_kb_originals TO authenticated;
GRANT ALL ON public.beacon_kb_originals TO service_role;

ALTER TABLE public.beacon_kb_originals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beacon_kb_originals_select" ON public.beacon_kb_originals
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "beacon_kb_originals_insert" ON public.beacon_kb_originals
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "beacon_kb_originals_update" ON public.beacon_kb_originals
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "beacon_kb_originals_delete" ON public.beacon_kb_originals
  FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE TRIGGER update_beacon_kb_originals_updated_at
  BEFORE UPDATE ON public.beacon_kb_originals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies: private bucket, company-scoped through the originals table.
CREATE POLICY "kb_originals_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kb-originals'
    AND EXISTS (
      SELECT 1 FROM public.beacon_kb_originals o
      WHERE o.storage_path = storage.objects.name
        AND o.company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "kb_originals_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'kb-originals'
    AND EXISTS (
      SELECT 1 FROM public.beacon_kb_originals o
      WHERE o.storage_path = storage.objects.name
        AND o.company_id = public.get_user_company_id()
    )
  );

-- Security finding: RFI attachment uploads must be scoped to the uploader's company.
DROP POLICY IF EXISTS "Upload RFI attachments to valid RFI folder" ON storage.objects;

CREATE POLICY "Upload RFI attachments to valid RFI folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rfi-attachments'
    AND EXISTS (
      SELECT 1 FROM public.rfi_requests r
      WHERE r.id::text = (storage.foldername(storage.objects.name))[1]
        AND r.company_id = public.get_user_company_id()
        AND r.status::text = ANY (ARRAY['draft','sent','viewed','submitted'])
    )
    AND lower(name) ~ '\.(pdf|png|jpg|jpeg|webp|gif|heic|heif|doc|docx|xls|xlsx|csv|txt)$'
  );

SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE (schemaname = 'storage' AND tablename = 'objects' AND (policyname LIKE 'kb_originals%' OR policyname = 'Upload RFI attachments to valid RFI folder'))
   OR (schemaname = 'public' AND tablename = 'beacon_kb_originals')
ORDER BY tablename, cmd, policyname;