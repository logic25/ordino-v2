REVOKE SELECT (access_token, refresh_token) ON public.gmail_connections FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.gmail_connections FROM anon;