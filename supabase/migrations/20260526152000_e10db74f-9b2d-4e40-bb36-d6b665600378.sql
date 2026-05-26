
-- 1. Beacon tables: remove blanket authenticated read
DROP POLICY IF EXISTS "Authenticated read" ON public.beacon_interactions;
DROP POLICY IF EXISTS "Authenticated read" ON public.beacon_feedback;
DROP POLICY IF EXISTS "Authenticated read" ON public.beacon_api_usage;

-- 2. Storage: drop unscoped authenticated policies on rfp-documents (scoped variants exist)
DROP POLICY IF EXISTS "Authenticated users can read rfp docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload rfp docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete rfp docs" ON storage.objects;

-- 3. Storage: drop unscoped documents policies (scoped variants exist)
DROP POLICY IF EXISTS "Users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents for their company" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their documents" ON storage.objects;

-- 4. Storage: replace unscoped universal-documents upload/delete with folder-scoped
DROP POLICY IF EXISTS "Company members can upload universal docs" ON storage.objects;
DROP POLICY IF EXISTS "Company members can delete universal docs" ON storage.objects;

CREATE POLICY "Company members can upload universal docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'universal-documents'
  AND (storage.foldername(name))[1] = (get_user_company_id())::text
);

CREATE POLICY "Company members can delete universal docs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'universal-documents'
  AND (storage.foldername(name))[1] = (get_user_company_id())::text
);

-- 5. Storage: replace unscoped action-item-attachments read with folder-scoped
DROP POLICY IF EXISTS "Company members can view action item attachments" ON storage.objects;

CREATE POLICY "Company members can view action item attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'action-item-attachments'
  AND (storage.foldername(name))[1] = (get_user_company_id())::text
);
