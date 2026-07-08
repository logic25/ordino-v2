REVOKE ALL ON FUNCTION public.user_portal_client_ids(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.portal_user_can_access_project(uuid, uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.user_portal_client_ids(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.portal_user_can_access_project(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_portal_client_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.portal_user_can_access_project(uuid, uuid, uuid, uuid) TO authenticated, service_role;

SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('user_portal_client_ids', 'portal_user_can_access_project')
ORDER BY p.proname;