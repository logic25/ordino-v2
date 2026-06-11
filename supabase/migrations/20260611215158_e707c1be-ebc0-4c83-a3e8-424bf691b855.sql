
-- 1. Profiles: prevent self-escalation on INSERT by enforcing default 'pm' role
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
CREATE POLICY "Users can create own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'pm'::user_role
    AND is_active = true
  );

-- 2. QBO connections: remove client-readable policies; only service_role may access tokens
DROP POLICY IF EXISTS "Admins can manage qbo_connections" ON public.qbo_connections;
DROP POLICY IF EXISTS "Admins can view qbo_connections" ON public.qbo_connections;

CREATE POLICY "Service role manages qbo_connections"
  ON public.qbo_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow admins to see only whether a connection exists (non-secret metadata)
-- via a SECURITY DEFINER view-style RPC. For now, expose only existence flag.
CREATE OR REPLACE FUNCTION public.has_qbo_connection(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.qbo_connections WHERE company_id = _company_id
  ) AND public.is_company_admin(_company_id);
$$;
GRANT EXECUTE ON FUNCTION public.has_qbo_connection(uuid) TO authenticated;

-- 3. Realtime messages: replace substring-based topic match with strict prefix match
DROP POLICY IF EXISTS "Authenticated users can subscribe to scoped topics" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to scoped topics"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      realtime.topic() LIKE ('user:' || auth.uid()::text || ':%')
      OR realtime.topic() = ('user:' || auth.uid()::text)
      OR (
        current_user_company_id() IS NOT NULL
        AND (
          realtime.topic() LIKE ('company:' || current_user_company_id()::text || ':%')
          OR realtime.topic() = ('company:' || current_user_company_id()::text)
        )
      )
    )
  );
