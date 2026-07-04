
-- 1. Revoke direct column writes on profiles.role (from both client roles).
--    The DEFAULT 'pm' on the column still applies on INSERT when the column is omitted.
REVOKE INSERT (role), UPDATE (role) ON public.profiles FROM authenticated;
REVOKE INSERT (role), UPDATE (role) ON public.profiles FROM anon;

-- service_role keeps full access (used by edge functions / triggers).

-- 2. Admin-gated role mutation function.
CREATE OR REPLACE FUNCTION public.admin_set_profile_role(
  _profile_id uuid,
  _new_role public.user_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_company uuid;
  target_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT company_id, user_id INTO target_company, target_user
  FROM public.profiles
  WHERE id = _profile_id;

  IF target_company IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Only company admins for the target profile's company may change roles.
  IF NOT public.is_company_admin(target_company) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  -- Prevent an admin from demoting themselves if they are the last admin in the company.
  IF target_user = auth.uid() AND _new_role <> 'admin'::public.user_role THEN
    IF (
      SELECT count(*) FROM public.profiles
      WHERE company_id = target_company
        AND role = 'admin'::public.user_role
        AND id <> _profile_id
    ) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot remove the last admin');
    END IF;
  END IF;

  UPDATE public.profiles
     SET role = _new_role,
         updated_at = now()
   WHERE id = _profile_id;

  RETURN jsonb_build_object('success', true, 'profile_id', _profile_id, 'role', _new_role);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_profile_role(uuid, public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_role(uuid, public.user_role) TO authenticated;

-- 3. Verification: confirm column-level privileges no longer include role for authenticated/anon.
SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'role'
ORDER BY grantee, privilege_type;
