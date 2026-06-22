
-- 1) Authorization functions: read roles from user_roles (not profiles.role).
--    Still join profiles for the is_active check.

CREATE OR REPLACE FUNCTION public.has_role(target_company_id uuid, required_role user_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p
      ON p.user_id = ur.user_id
     AND p.company_id = ur.company_id
    WHERE ur.user_id = auth.uid()
      AND ur.company_id = target_company_id
      AND ur.role::text = required_role::text
      AND p.is_active = true
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p
      ON p.user_id = ur.user_id
     AND p.company_id = ur.company_id
    WHERE ur.user_id = auth.uid()
      AND ur.company_id = target_company_id
      AND ur.role::text IN ('admin','manager')
      AND p.is_active = true
  )
$function$;

CREATE OR REPLACE FUNCTION public.can_modify_operations(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p
      ON p.user_id = ur.user_id
     AND p.company_id = ur.company_id
    WHERE ur.user_id = auth.uid()
      AND ur.company_id = target_company_id
      AND ur.role::text IN ('admin','manager','production','pm')
      AND p.is_active = true
  )
$function$;

-- is_company_admin already delegates to has_role; recreate to keep search_path explicit.
CREATE OR REPLACE FUNCTION public.is_company_admin(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(target_company_id, 'admin'::user_role)
$function$;

-- 2) Restrict user_monthly_goals SELECT to owner or company admin.
--    Drop the existing broad SELECT policy by its actual pg_policies name.
DROP POLICY IF EXISTS "Company members can view user_monthly_goals" ON public.user_monthly_goals;

CREATE POLICY "Owners and admins can view user_monthly_goals"
  ON public.user_monthly_goals
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_company_admin(company_id)
  );

-- Verify the policy state.
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'user_monthly_goals'
    AND policyname = 'Owners and admins can view user_monthly_goals';
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one owners/admins SELECT policy on user_monthly_goals, found %', cnt;
  END IF;
END $$;
