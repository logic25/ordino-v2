-- Allow company members to read any rfp-documents object that is referenced
-- by an rfp_content row belonging to their company. This keeps the strict
-- INSERT/DELETE scoping (new uploads must live under <company_id>/...)
-- while making historic "attachments/<uuid>.ext" objects (uploaded before
-- the company-scoped path convention) accessible to the team that owns them.

DROP POLICY IF EXISTS "Scoped read rfp-documents" ON storage.objects;

CREATE POLICY "Scoped read rfp-documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'rfp-documents'
  AND (
    (storage.foldername(name))[1] = public.get_user_company_id()::text
    OR EXISTS (
      SELECT 1 FROM public.rfp_content rc
      WHERE rc.company_id = public.get_user_company_id()
        AND rc.content ->> 'file_path' = storage.objects.name
    )
  )
);