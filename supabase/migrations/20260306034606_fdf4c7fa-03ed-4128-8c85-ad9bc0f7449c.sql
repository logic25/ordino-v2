
-- Drop and recreate get_user_app_roles with text[] return type
DROP FUNCTION IF EXISTS public.get_user_app_roles(uuid);

CREATE OR REPLACE FUNCTION public.get_user_app_roles(_user_id uuid)
  RETURNS text[]
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(role), '{}')
  FROM public.user_roles
  WHERE user_id = _user_id
$$;
