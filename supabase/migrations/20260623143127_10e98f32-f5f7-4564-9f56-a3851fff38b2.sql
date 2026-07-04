
-- 1. Add 'content' to the role-permission seeder
CREATE OR REPLACE FUNCTION public.seed_permissions_for_role(target_company_id uuid, role_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  resources text[] := ARRAY[
    'dashboard','projects','properties','proposals','invoices',
    'time_logs','emails','calendar','documents','clients',
    'settings','users','roles','reports','rfps','content'
  ];
  r text;
BEGIN
  FOREACH r IN ARRAY resources LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, role_name, r, false, false, false, false, false, false)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;
END;
$function$;

-- Backfill 'content' rows for every existing (company_id, role) pair.
-- Admin gets full access, everyone else gets locked out.
INSERT INTO public.role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
SELECT DISTINCT
  rp.company_id,
  rp.role,
  'content'::text,
  (rp.role = 'admin'),
  (rp.role = 'admin'),
  (rp.role = 'admin'),
  (rp.role = 'admin'),
  (rp.role = 'admin'),
  (rp.role = 'admin')
FROM public.role_permissions rp
ON CONFLICT (company_id, role, resource) DO NOTHING;

-- 2. Lock profile goal columns at the RLS layer
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND role = (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
  AND company_id = (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.user_id = auth.uid())
  AND is_comp_admin = (SELECT p.is_comp_admin FROM public.profiles p WHERE p.user_id = auth.uid())
  AND monthly_goal IS NOT DISTINCT FROM (SELECT p.monthly_goal FROM public.profiles p WHERE p.user_id = auth.uid())
  AND weekly_goal IS NOT DISTINCT FROM (SELECT p.weekly_goal FROM public.profiles p WHERE p.user_id = auth.uid())
  AND accuracy_goal IS NOT DISTINCT FROM (SELECT p.accuracy_goal FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- 3. Scope content-images bucket to the uploader's company
-- New path layout: <company_id>/<candidate_id>/<filename>
DROP POLICY IF EXISTS "content-images authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "content-images authenticated write" ON storage.objects;
DROP POLICY IF EXISTS "content-images authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "content-images authenticated delete" ON storage.objects;

CREATE POLICY "content-images company-scoped read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'content-images'
  AND (storage.foldername(name))[1] = public.get_user_company_id()::text
);

CREATE POLICY "content-images company-scoped write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'content-images'
  AND (storage.foldername(name))[1] = public.get_user_company_id()::text
);

CREATE POLICY "content-images company-scoped update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'content-images'
  AND (storage.foldername(name))[1] = public.get_user_company_id()::text
)
WITH CHECK (
  bucket_id = 'content-images'
  AND (storage.foldername(name))[1] = public.get_user_company_id()::text
);

CREATE POLICY "content-images company-scoped delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'content-images'
  AND (storage.foldername(name))[1] = public.get_user_company_id()::text
);

-- Verify the policies actually landed
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'content-images%';

SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'UPDATE';
