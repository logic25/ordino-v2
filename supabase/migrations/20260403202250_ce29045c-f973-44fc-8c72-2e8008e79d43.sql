
-- action-item-attachments (the old "Company members can upload" already exists, drop it first)
DROP POLICY IF EXISTS "Company members can upload action item attachments" ON storage.objects;
DROP POLICY IF EXISTS "Company members can read action item attachments" ON storage.objects;
DROP POLICY IF EXISTS "Company members can delete action item attachments" ON storage.objects;

CREATE POLICY "Scoped read action-item-attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'action-item-attachments' AND (storage.foldername(name))[1] = public.get_user_company_id()::text);

CREATE POLICY "Scoped upload action-item-attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'action-item-attachments' AND (storage.foldername(name))[1] = public.get_user_company_id()::text);

CREATE POLICY "Scoped delete action-item-attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'action-item-attachments' AND (storage.foldername(name))[1] = public.get_user_company_id()::text);

-- billing-rule-docs
DROP POLICY IF EXISTS "Company members can read billing rule docs" ON storage.objects;
DROP POLICY IF EXISTS "Company members can upload billing rule docs" ON storage.objects;
DROP POLICY IF EXISTS "Company members can delete billing rule docs" ON storage.objects;

CREATE POLICY "Scoped read billing-rule-docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'billing-rule-docs' AND (storage.foldername(name))[1] = public.get_user_company_id()::text);

CREATE POLICY "Scoped upload billing-rule-docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'billing-rule-docs' AND (storage.foldername(name))[1] = public.get_user_company_id()::text);

CREATE POLICY "Scoped delete billing-rule-docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'billing-rule-docs' AND (storage.foldername(name))[1] = public.get_user_company_id()::text);

-- documents
DROP POLICY IF EXISTS "Company members can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Company members can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Company members can delete documents" ON storage.objects;

CREATE POLICY "Scoped read documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_user_company_id()::text);

CREATE POLICY "Scoped upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_user_company_id()::text);

CREATE POLICY "Scoped delete documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_user_company_id()::text);

-- rfp-documents
DROP POLICY IF EXISTS "Company members can read rfp documents" ON storage.objects;
DROP POLICY IF EXISTS "Company members can upload rfp documents" ON storage.objects;
DROP POLICY IF EXISTS "Company members can delete rfp documents" ON storage.objects;

CREATE POLICY "Scoped read rfp-documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'rfp-documents' AND (storage.foldername(name))[1] = public.get_user_company_id()::text);

CREATE POLICY "Scoped upload rfp-documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'rfp-documents' AND (storage.foldername(name))[1] = public.get_user_company_id()::text);

CREATE POLICY "Scoped delete rfp-documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'rfp-documents' AND (storage.foldername(name))[1] = public.get_user_company_id()::text);
