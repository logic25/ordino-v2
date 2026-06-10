
-- 1. Beacon tables: drop admin SELECT, keep service_role only
DROP POLICY IF EXISTS "Admins can view beacon api usage" ON public.beacon_api_usage;
DROP POLICY IF EXISTS "Admins can view beacon corrections" ON public.beacon_corrections;
DROP POLICY IF EXISTS "Admins can view beacon feedback" ON public.beacon_feedback;
DROP POLICY IF EXISTS "Admins can view beacon interactions" ON public.beacon_interactions;
DROP POLICY IF EXISTS "Admins can view beacon suggestions" ON public.beacon_suggestions;

-- 2. Realtime channels: scope subscriptions
CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

DROP POLICY IF EXISTS "Authenticated users can use realtime" ON realtime.messages;

CREATE POLICY "Authenticated users can subscribe to scoped topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    realtime.topic() LIKE 'public:%'
    OR realtime.topic() LIKE 'realtime:public:%'
    OR position(auth.uid()::text in realtime.topic()) > 0
    OR (
      public.current_user_company_id() IS NOT NULL
      AND position(public.current_user_company_id()::text in realtime.topic()) > 0
    )
  )
);

-- 3. ai_roadmap_suggestions: enforce NOT NULL company_id
ALTER TABLE public.ai_roadmap_suggestions
  ALTER COLUMN company_id SET NOT NULL;

-- 4. bug-attachments: scoped read policy (bucket already private)
DROP POLICY IF EXISTS "Anyone can view bug attachments" ON storage.objects;

CREATE POLICY "Company members can view bug attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'bug-attachments'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.company_id::text = split_part(name, '/', 1)
  )
);

-- 5. Profiles: hide compensation columns
REVOKE SELECT (hourly_rate, monthly_goal) ON public.profiles FROM authenticated;
REVOKE SELECT (hourly_rate, monthly_goal) ON public.profiles FROM anon;

CREATE OR REPLACE FUNCTION public.get_team_monthly_goals()
RETURNS TABLE (profile_id uuid, monthly_goal numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_company uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_company IS NULL THEN RETURN; END IF;
  IF NOT public.is_admin_or_manager(v_company) THEN RETURN; END IF;
  RETURN QUERY
    SELECT p.id, p.monthly_goal FROM public.profiles p
    WHERE p.company_id = v_company AND p.is_active = true;
END; $$;

CREATE OR REPLACE FUNCTION public.get_my_compensation()
RETURNS TABLE (hourly_rate numeric, monthly_goal numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.hourly_rate, p.monthly_goal FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_profile_compensation(_profile_id uuid)
RETURNS TABLE (hourly_rate numeric, monthly_goal numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_company uuid; v_target uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  SELECT company_id INTO v_target FROM public.profiles WHERE id = _profile_id LIMIT 1;
  IF v_company IS NULL OR v_target IS NULL OR v_company <> v_target THEN RETURN; END IF;
  IF NOT public.is_admin_or_manager(v_company) THEN RETURN; END IF;
  RETURN QUERY SELECT p.hourly_rate, p.monthly_goal FROM public.profiles p WHERE p.id = _profile_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_team_monthly_goals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_compensation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_compensation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_company_id() TO authenticated;

-- 6. Clients: hide tax_id
REVOKE SELECT (tax_id) ON public.clients FROM authenticated;
REVOKE SELECT (tax_id) ON public.clients FROM anon;

CREATE OR REPLACE FUNCTION public.get_client_tax_id(_client_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_company uuid; v_client_co uuid; v_tax text;
BEGIN
  SELECT company_id INTO v_company FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  SELECT company_id, tax_id INTO v_client_co, v_tax FROM public.clients WHERE id = _client_id LIMIT 1;
  IF v_company IS NULL OR v_client_co IS NULL OR v_company <> v_client_co THEN RETURN NULL; END IF;
  IF NOT public.is_admin_or_manager(v_company) THEN RETURN NULL; END IF;
  RETURN v_tax;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_client_tax_id(uuid) TO authenticated;
