DELETE FROM public.rfp_content
WHERE content->>'file_path' LIKE 'attachments/%';

DROP POLICY IF EXISTS "Scoped read rfp-documents" ON storage.objects;

CREATE POLICY "Scoped read rfp-documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'rfp-documents'
  AND (storage.foldername(name))[1] = (get_user_company_id())::text
);