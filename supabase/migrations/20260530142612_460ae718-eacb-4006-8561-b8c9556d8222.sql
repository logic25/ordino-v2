
-- Tighten storage write policies and fix beacon RLS join

-- bug-attachments: scope writes by company folder
DROP POLICY IF EXISTS "Company members can upload bug attachments" ON storage.objects;
DROP POLICY IF EXISTS "Company members can delete bug attachments" ON storage.objects;

CREATE POLICY "Company members can upload bug attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bug-attachments'
  AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
);

CREATE POLICY "Company members can delete bug attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'bug-attachments'
  AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
);

-- company-assets: scope writes by company folder
DROP POLICY IF EXISTS "Authenticated users can upload company assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update company assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete company assets" ON storage.objects;

CREATE POLICY "Company members can upload company assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-assets'
  AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
);

CREATE POLICY "Company members can update company assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-assets'
  AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
);

CREATE POLICY "Company members can delete company assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'company-assets'
  AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
);

-- rfp-documents (private bucket): scope SELECT and DELETE by company folder
DROP POLICY IF EXISTS "Authenticated read rfp-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete rfp-documents" ON storage.objects;

CREATE POLICY "Scoped read rfp-documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'rfp-documents'
  AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
);

CREATE POLICY "Scoped delete rfp-documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'rfp-documents'
  AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
);

-- rfp-project-photos: scope writes by company folder
DROP POLICY IF EXISTS "Company members can upload project photos" ON storage.objects;
DROP POLICY IF EXISTS "Company members can delete project photos" ON storage.objects;

CREATE POLICY "Company members can upload project photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'rfp-project-photos'
  AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
);

CREATE POLICY "Company members can delete project photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'rfp-project-photos'
  AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
);

-- Fix incorrect profiles join on beacon_research_feedback SELECT policy
DROP POLICY IF EXISTS "Users can read own company feedback" ON public.beacon_research_feedback;

CREATE POLICY "Users can read own company feedback"
ON public.beacon_research_feedback FOR SELECT TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);
