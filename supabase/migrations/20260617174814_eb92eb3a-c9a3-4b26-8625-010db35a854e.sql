
-- ============================================================
-- FINDING 1: Gmail OAuth tokens — lock down completely
-- ============================================================

-- Drop all authenticated-role policies on gmail_connections.
DROP POLICY IF EXISTS "Users can view own gmail connection" ON public.gmail_connections;
DROP POLICY IF EXISTS "Users can insert own gmail connections" ON public.gmail_connections;
DROP POLICY IF EXISTS "Users can update own gmail connections" ON public.gmail_connections;
DROP POLICY IF EXISTS "Users can delete own gmail connections" ON public.gmail_connections;

-- Revoke all direct Data-API privileges from authenticated/anon.
REVOKE ALL ON public.gmail_connections FROM authenticated;
REVOKE ALL ON public.gmail_connections FROM anon;

-- service_role retains GRANT ALL (already granted via prior migrations); ensure it.
GRANT ALL ON public.gmail_connections TO service_role;

-- Keep RLS on. With no policies and no grants for authenticated/anon, any
-- direct query from the client returns zero rows / permission denied.
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

-- Add a deny-all explicit policy for clarity (defense in depth).
CREATE POLICY "gmail_connections_no_client_access"
  ON public.gmail_connections
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- Safe-status RPC: returns only non-secret fields for the current user.
CREATE OR REPLACE FUNCTION public.get_my_gmail_connection_status()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  company_id uuid,
  email_address text,
  sync_enabled boolean,
  last_sync_at timestamptz,
  token_expires_at timestamptz,
  history_id text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gc.id, gc.user_id, gc.company_id, gc.email_address, gc.sync_enabled,
         gc.last_sync_at, gc.token_expires_at, gc.history_id,
         gc.created_at, gc.updated_at
  FROM public.gmail_connections gc
  JOIN public.profiles p ON p.id = gc.user_id
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_gmail_connection_status() TO authenticated;


-- ============================================================
-- FINDING 2: Compensation moved to dedicated table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.employee_compensation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  hourly_rate numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill from profiles before dropping the column.
INSERT INTO public.employee_compensation (person_id, company_id, hourly_rate)
SELECT p.id, p.company_id, p.hourly_rate
FROM public.profiles p
WHERE p.company_id IS NOT NULL
ON CONFLICT (person_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_compensation TO authenticated;
GRANT ALL ON public.employee_compensation TO service_role;

ALTER TABLE public.employee_compensation ENABLE ROW LEVEL SECURITY;

-- SELECT: self or comp admin.
DROP POLICY IF EXISTS "employee_compensation_select" ON public.employee_compensation;
CREATE POLICY "employee_compensation_select"
  ON public.employee_compensation
  FOR SELECT
  TO authenticated
  USING (
    person_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR public.is_comp_admin(auth.uid())
  );

-- UPDATE: self (own rate) or comp admin.
DROP POLICY IF EXISTS "employee_compensation_update" ON public.employee_compensation;
CREATE POLICY "employee_compensation_update"
  ON public.employee_compensation
  FOR UPDATE
  TO authenticated
  USING (
    person_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR public.is_comp_admin(auth.uid())
  )
  WITH CHECK (
    person_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR public.is_comp_admin(auth.uid())
  );

-- INSERT: comp admin only (self rows backfilled; admins onboard new staff).
DROP POLICY IF EXISTS "employee_compensation_insert" ON public.employee_compensation;
CREATE POLICY "employee_compensation_insert"
  ON public.employee_compensation
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_comp_admin(auth.uid()));

-- DELETE: comp admin only.
DROP POLICY IF EXISTS "employee_compensation_delete" ON public.employee_compensation;
CREATE POLICY "employee_compensation_delete"
  ON public.employee_compensation
  FOR DELETE
  TO authenticated
  USING (public.is_comp_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_employee_compensation_updated_at ON public.employee_compensation;
CREATE TRIGGER trg_employee_compensation_updated_at
  BEFORE UPDATE ON public.employee_compensation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create employee_compensation row for new profiles.
CREATE OR REPLACE FUNCTION public.ensure_employee_compensation_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    INSERT INTO public.employee_compensation (person_id, company_id, hourly_rate)
    VALUES (NEW.id, NEW.company_id, NULL)
    ON CONFLICT (person_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_profiles_ensure_compensation ON public.profiles;
CREATE TRIGGER trg_profiles_ensure_compensation
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_employee_compensation_row();

-- ============================================================
-- Recreate compensation helper functions to read from new table
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_compensation()
RETURNS TABLE (hourly_rate numeric, monthly_goal numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ec.hourly_rate, p.monthly_goal
  FROM public.profiles p
  LEFT JOIN public.employee_compensation ec ON ec.person_id = p.id
  WHERE p.user_id = auth.uid()
  LIMIT 1;
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
  IF NOT (public.is_admin_or_manager(v_company) OR public.is_comp_admin(auth.uid())) THEN RETURN; END IF;
  RETURN QUERY
    SELECT ec.hourly_rate, p.monthly_goal
    FROM public.profiles p
    LEFT JOIN public.employee_compensation ec ON ec.person_id = p.id
    WHERE p.id = _profile_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_my_compensation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_compensation(uuid) TO authenticated;

-- Get own hourly rate (simple scalar).
CREATE OR REPLACE FUNCTION public.get_my_hourly_rate()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ec.hourly_rate
  FROM public.employee_compensation ec
  JOIN public.profiles p ON p.id = ec.person_id
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_hourly_rate() TO authenticated;

-- Set own hourly rate.
CREATE OR REPLACE FUNCTION public.set_my_hourly_rate(_rate numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid; v_company uuid;
BEGIN
  SELECT id, company_id INTO v_pid, v_company
  FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_pid IS NULL OR v_company IS NULL THEN RAISE EXCEPTION 'No profile'; END IF;
  INSERT INTO public.employee_compensation (person_id, company_id, hourly_rate)
  VALUES (v_pid, v_company, _rate)
  ON CONFLICT (person_id) DO UPDATE SET hourly_rate = EXCLUDED.hourly_rate, updated_at = now();
END; $$;
GRANT EXECUTE ON FUNCTION public.set_my_hourly_rate(numeric) TO authenticated;

-- Admin set someone else's rate.
CREATE OR REPLACE FUNCTION public.upsert_employee_hourly_rate(_person_id uuid, _rate numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; v_target_company uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  SELECT company_id INTO v_target_company FROM public.profiles WHERE id = _person_id LIMIT 1;
  IF v_company IS NULL OR v_target_company IS NULL OR v_company <> v_target_company THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF NOT public.is_comp_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Comp admin only';
  END IF;
  INSERT INTO public.employee_compensation (person_id, company_id, hourly_rate)
  VALUES (_person_id, v_target_company, _rate)
  ON CONFLICT (person_id) DO UPDATE SET hourly_rate = EXCLUDED.hourly_rate, updated_at = now();
END; $$;
GRANT EXECUTE ON FUNCTION public.upsert_employee_hourly_rate(uuid, numeric) TO authenticated;

-- Batch lookup for activity-cost calc (returns rate only when caller is comp admin
-- or the user_id is the caller's own profile).
CREATE OR REPLACE FUNCTION public.get_user_hourly_rates(_user_ids uuid[])
RETURNS TABLE (user_id uuid, hourly_rate numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_self uuid; v_company uuid; v_is_admin boolean;
BEGIN
  SELECT id, company_id INTO v_self, v_company
  FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_company IS NULL THEN RETURN; END IF;
  v_is_admin := public.is_comp_admin(auth.uid());
  RETURN QUERY
    SELECT p.id AS user_id, ec.hourly_rate
    FROM public.profiles p
    LEFT JOIN public.employee_compensation ec ON ec.person_id = p.id
    WHERE p.id = ANY(_user_ids)
      AND p.company_id = v_company
      AND (v_is_admin OR p.id = v_self);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_user_hourly_rates(uuid[]) TO authenticated;

-- ============================================================
-- Drop hourly_rate from profiles (data already migrated)
-- ============================================================
ALTER TABLE public.profiles DROP COLUMN IF EXISTS hourly_rate;
