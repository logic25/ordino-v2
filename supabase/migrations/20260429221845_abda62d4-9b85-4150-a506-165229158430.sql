-- Pending invites table
CREATE TABLE IF NOT EXISTS public.pending_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'staff',
  first_name text,
  last_name text,
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pending_invites_email_lowercase CHECK (email = lower(email)),
  CONSTRAINT pending_invites_email_domain CHECK (email LIKE '%@greenlightexpediting.com')
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_invites_company_email_unique
  ON public.pending_invites (company_id, email)
  WHERE accepted_at IS NULL;

ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage company invites" ON public.pending_invites;
CREATE POLICY "Admins manage company invites"
ON public.pending_invites
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));

-- Replace auto_join_existing_company with domain check + invite consumption
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
  use_role public.user_role := 'staff';
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

  -- Consume a pending invite if one exists
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

  -- Mirror admin into user_roles for app_role checks
  IF use_role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (auth.uid(), 'admin'::app_role, target_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  RETURN target_company_id;
END;
$function$;

-- Last sign-in helper (admin-only via RLS check)
CREATE OR REPLACE FUNCTION public.get_team_last_signins(target_company_id uuid)
RETURNS TABLE (user_id uuid, last_sign_in_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_company_admin(target_company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT p.user_id, u.last_sign_in_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.company_id = target_company_id;
END;
$function$;
