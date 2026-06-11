REVOKE EXECUTE ON FUNCTION public.has_qbo_connection(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_qbo_connection(uuid) TO authenticated;