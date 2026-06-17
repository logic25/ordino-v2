DROP POLICY IF EXISTS "Anyone can view project photos" ON storage.objects;

CREATE POLICY "Company members can view project photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'rfp-project-photos'
  AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
);