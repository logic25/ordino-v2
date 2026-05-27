
DROP POLICY IF EXISTS "Scoped read rfp-documents" ON storage.objects;
DROP POLICY IF EXISTS "Scoped delete rfp-documents" ON storage.objects;

CREATE POLICY "Authenticated read rfp-documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'rfp-documents');

CREATE POLICY "Authenticated delete rfp-documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'rfp-documents');
