
-- 1. Emails realtime: stop broadcasting to prevent cross-tenant leak risk
ALTER PUBLICATION supabase_realtime DROP TABLE public.emails;

-- 2. Profiles: prevent users from elevating their own role/company/active status
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid())
  AND company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  AND is_active = (SELECT is_active FROM public.profiles WHERE user_id = auth.uid())
);

-- 3. QBO connections: revoke client read access on sensitive token columns
REVOKE SELECT (access_token, refresh_token) ON public.qbo_connections FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.qbo_connections FROM anon;
-- service_role retains full access via GRANT ALL defaults

-- 4. RFI attachments: restrict upload to authenticated users only
DROP POLICY IF EXISTS "Upload RFI attachments to valid RFI folder" ON storage.objects;
CREATE POLICY "Upload RFI attachments to valid RFI folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rfi-attachments'
  AND EXISTS (
    SELECT 1 FROM public.rfi_requests r
    WHERE r.id::text = (storage.foldername(objects.name))[1]
      AND r.status::text = ANY (ARRAY['draft','sent','viewed','submitted'])
      AND r.company_id = public.get_user_company_id()
  )
);

-- 5. Add missing UPDATE policies for storage buckets
CREATE POLICY "Scoped update documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_user_company_id()::text)
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_user_company_id()::text);

CREATE POLICY "Scoped update billing-rule-docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'billing-rule-docs' AND (storage.foldername(name))[1] = public.get_user_company_id()::text)
WITH CHECK (bucket_id = 'billing-rule-docs' AND (storage.foldername(name))[1] = public.get_user_company_id()::text);

CREATE POLICY "Company members can update universal docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'universal-documents' AND (storage.foldername(name))[1] = public.get_user_company_id()::text)
WITH CHECK (bucket_id = 'universal-documents' AND (storage.foldername(name))[1] = public.get_user_company_id()::text);

-- 6. user_roles: only admins can view all company roles (users still see own roles via separate policy)
DROP POLICY IF EXISTS "Admins can view company roles" ON public.user_roles;
CREATE POLICY "Admins can view company roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_app_role(auth.uid(), 'admin'));
