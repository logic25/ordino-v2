
CREATE OR REPLACE FUNCTION public.can_access_portal_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.portal_role = 'gle_staff'
  )
  OR EXISTS (
    SELECT 1
    FROM public.projects pr
    JOIN public.client_org_memberships m ON m.client_org_id = pr.client_org_id
    WHERE pr.id = _project_id
      AND m.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_portal_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_portal_project(uuid) TO authenticated;

DROP POLICY IF EXISTS "portal-docs: staff write" ON storage.objects;
DROP POLICY IF EXISTS "portal-docs: staff update" ON storage.objects;
DROP POLICY IF EXISTS "portal-docs: staff delete" ON storage.objects;
DROP POLICY IF EXISTS "portal-docs: member read" ON storage.objects;

CREATE POLICY "portal-docs: staff write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'portal-documents'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.portal_role = 'gle_staff')
);

CREATE POLICY "portal-docs: staff update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'portal-documents'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.portal_role = 'gle_staff')
);

CREATE POLICY "portal-docs: staff delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'portal-documents'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.portal_role = 'gle_staff')
);

CREATE POLICY "portal-docs: member read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'portal-documents'
  AND public.can_access_portal_project(((storage.foldername(name))[1])::uuid)
);
