
-- 1. Drop duplicate gmail_connections SELECT policy (keep the one that scopes to owner)
DROP POLICY IF EXISTS "Users can view own gmail connections" ON public.gmail_connections;

-- 2. Revoke client access to OAuth token columns (service_role still has access for edge functions)
REVOKE SELECT (access_token, refresh_token) ON public.gmail_connections FROM authenticated, anon;
REVOKE SELECT (access_token, refresh_token) ON public.qbo_connections FROM authenticated, anon;
