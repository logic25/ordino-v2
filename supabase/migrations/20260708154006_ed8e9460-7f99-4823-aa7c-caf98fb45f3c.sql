CREATE OR REPLACE FUNCTION public.user_portal_client_ids(_uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT co.client_id
  FROM public.client_org_memberships com
  JOIN public.client_orgs co ON co.id = com.client_org_id
  WHERE com.user_id = _uid
    AND co.client_id IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.portal_user_can_access_project(
  _uid uuid,
  _project_client_org_id uuid,
  _project_client_id uuid,
  _project_building_owner_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_gle_staff(_uid)
    OR (
      _project_client_org_id IS NOT NULL
      AND _project_client_org_id IN (SELECT public.user_client_org_ids(_uid))
    )
    OR (
      _project_client_id IS NOT NULL
      AND _project_client_id IN (SELECT public.user_portal_client_ids(_uid))
    )
    OR (
      _project_building_owner_id IS NOT NULL
      AND _project_building_owner_id IN (SELECT public.user_portal_client_ids(_uid))
    );
$function$;

DROP POLICY IF EXISTS "projects: portal clients read linked projects" ON public.projects;
CREATE POLICY "projects: portal clients read linked projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  public.portal_user_can_access_project(
    auth.uid(),
    client_org_id,
    client_id,
    building_owner_id
  )
);

DROP POLICY IF EXISTS "filings: portal read" ON public.filings;
CREATE POLICY "filings: portal read"
ON public.filings
FOR SELECT
TO authenticated
USING (
  public.is_gle_staff(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = filings.project_id
      AND public.portal_user_can_access_project(
        auth.uid(),
        p.client_org_id,
        p.client_id,
        p.building_owner_id
      )
  )
);

DROP POLICY IF EXISTS "cai: portal read" ON public.client_action_items;
CREATE POLICY "cai: portal read"
ON public.client_action_items
FOR SELECT
TO authenticated
USING (
  public.is_gle_staff(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = client_action_items.project_id
      AND public.portal_user_can_access_project(
        auth.uid(),
        p.client_org_id,
        p.client_id,
        p.building_owner_id
      )
  )
);

DROP POLICY IF EXISTS "portal_docs: portal read" ON public.portal_documents;
CREATE POLICY "portal_docs: portal read"
ON public.portal_documents
FOR SELECT
TO authenticated
USING (
  public.is_gle_staff(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = portal_documents.project_id
      AND public.portal_user_can_access_project(
        auth.uid(),
        p.client_org_id,
        p.client_id,
        p.building_owner_id
      )
  )
);

SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'filings', 'client_action_items', 'portal_documents')
ORDER BY tablename, policyname;