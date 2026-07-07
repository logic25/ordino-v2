
REVOKE EXECUTE ON FUNCTION public.user_client_org_ids(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_gle_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.filings_on_change() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cai_on_insert() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.portal_touch_updated_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_client_org_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_gle_staff(uuid) TO authenticated, service_role;
