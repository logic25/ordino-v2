
ALTER TABLE public.generated_content
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS cover_image_attribution text;

DROP POLICY IF EXISTS "content-images authenticated read" ON storage.objects;
CREATE POLICY "content-images authenticated read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'content-images');

DROP POLICY IF EXISTS "content-images authenticated write" ON storage.objects;
CREATE POLICY "content-images authenticated write" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'content-images');

DROP POLICY IF EXISTS "content-images authenticated update" ON storage.objects;
CREATE POLICY "content-images authenticated update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'content-images');

DROP POLICY IF EXISTS "content-images authenticated delete" ON storage.objects;
CREATE POLICY "content-images authenticated delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'content-images');
