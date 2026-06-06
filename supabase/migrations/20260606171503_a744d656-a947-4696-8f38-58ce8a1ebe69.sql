REVOKE SELECT (access_token, refresh_token) ON public.qbo_connections FROM authenticated;
REVOKE UPDATE (access_token, refresh_token) ON public.qbo_connections FROM authenticated;
REVOKE INSERT (access_token, refresh_token) ON public.qbo_connections FROM authenticated;