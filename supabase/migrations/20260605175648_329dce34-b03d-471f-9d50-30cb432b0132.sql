CREATE OR REPLACE FUNCTION public.auto_join_existing_company(first_name text, last_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_company_id uuid;
  existing_company_id uuid;
  user_email text;
  invite_row record;
  use_first text := first_name;
  use_last text := last_name;
  use_role public.user_role := 'production';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  user_email := lower(auth.jwt() ->> 'email');

  IF user_email IS NULL OR user_email NOT LIKE '%@greenlightexpediting.com' THEN
    RAISE EXCEPTION 'Only @greenlightexpediting.com accounts can join.';
  END IF;

  SELECT company_id INTO existing_company_id
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF existing_company_id IS NOT NULL THEN
    RETURN existing_company_id;
  END IF;

  SELECT id INTO target_company_id
  FROM public.companies
  LIMIT 1;

  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'No company found';
  END IF;

  SELECT * INTO invite_row
  FROM public.pending_invites
  WHERE company_id = target_company_id
    AND email = user_email
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    use_role := invite_row.role;
    IF invite_row.first_name IS NOT NULL AND invite_row.first_name <> '' THEN
      use_first := invite_row.first_name;
    END IF;
    IF invite_row.last_name IS NOT NULL AND invite_row.last_name <> '' THEN
      use_last := invite_row.last_name;
    END IF;

    UPDATE public.pending_invites
    SET accepted_at = now()
    WHERE id = invite_row.id;
  END IF;

  INSERT INTO public.profiles (user_id, company_id, role, first_name, last_name, display_name)
  VALUES (
    auth.uid(),
    target_company_id,
    use_role,
    use_first,
    use_last,
    use_first || ' ' || use_last
  );

  IF use_role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (auth.uid(), 'admin'::app_role, target_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  RETURN target_company_id;
END;
$function$;

UPDATE public.profiles SET role = 'production'::user_role WHERE role = 'staff'::user_role;