
-- 1) Tighten employee_compensation: only comp admins can SELECT directly.
DROP POLICY IF EXISTS "employee_compensation_select" ON public.employee_compensation;
CREATE POLICY "employee_compensation_select"
  ON public.employee_compensation
  FOR SELECT
  TO authenticated
  USING (public.is_comp_admin(auth.uid()));

-- 2) Revoke column-level SELECT on goal fields. RLS cannot filter columns,
-- so column GRANTs are the only way to hide them from direct table reads.
REVOKE SELECT (monthly_goal, weekly_goal, accuracy_goal)
  ON public.profiles FROM authenticated;
REVOKE SELECT (monthly_goal, weekly_goal, accuracy_goal)
  ON public.profiles FROM anon;

-- 3) Helper RPCs so the app can still read goals via the API.
-- Both are SECURITY DEFINER and owned by postgres, which bypasses the
-- column REVOKE above.

-- Caller's own goals.
CREATE OR REPLACE FUNCTION public.get_my_goals()
RETURNS TABLE (monthly_goal numeric, weekly_goal numeric, accuracy_goal numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.monthly_goal, p.weekly_goal, p.accuracy_goal
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_goals() TO authenticated;

-- All active company members' goals (scoped to caller's company).
CREATE OR REPLACE FUNCTION public.get_company_goals()
RETURNS TABLE (
  id uuid,
  role text,
  is_active boolean,
  monthly_goal numeric,
  weekly_goal numeric,
  accuracy_goal numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_company uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_company IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT p.id, p.role::text, p.is_active, p.monthly_goal, p.weekly_goal, p.accuracy_goal
    FROM public.profiles p
    WHERE p.company_id = v_company;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_company_goals() TO authenticated;
