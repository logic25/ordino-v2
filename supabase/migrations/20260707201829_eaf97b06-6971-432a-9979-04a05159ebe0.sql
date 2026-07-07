-- Client portal invites table
CREATE TABLE IF NOT EXISTS public.client_portal_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_org_id uuid NOT NULL REFERENCES public.client_orgs(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_portal_invites_email_lowercase CHECK (email = lower(email))
);

CREATE UNIQUE INDEX IF NOT EXISTS client_portal_invites_org_email_unique
  ON public.client_portal_invites (client_org_id, email)
  WHERE accepted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cpi_email ON public.client_portal_invites(email);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portal_invites TO authenticated;
GRANT ALL ON public.client_portal_invites TO service_role;

ALTER TABLE public.client_portal_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GLE staff manage client portal invites"
  ON public.client_portal_invites FOR ALL TO authenticated
  USING (public.is_gle_staff(auth.uid()))
  WITH CHECK (public.is_gle_staff(auth.uid()));

-- Accept client portal invite: creates profile + membership for the signed-in user
CREATE OR REPLACE FUNCTION public.accept_client_portal_invite(first_name text, last_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email text;
  invite_row record;
  existing_profile_id uuid;
  use_first text := first_name;
  use_last  text := last_name;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  user_email := lower(auth.jwt() ->> 'email');
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'No email on session';
  END IF;

  SELECT id INTO existing_profile_id FROM public.profiles WHERE user_id = auth.uid();

  SELECT * INTO invite_row
  FROM public.client_portal_invites
  WHERE email = user_email
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending client portal invite for %', user_email;
  END IF;

  IF invite_row.first_name IS NOT NULL AND invite_row.first_name <> '' THEN
    use_first := invite_row.first_name;
  END IF;
  IF invite_row.last_name IS NOT NULL AND invite_row.last_name <> '' THEN
    use_last := invite_row.last_name;
  END IF;

  IF existing_profile_id IS NULL THEN
    INSERT INTO public.profiles (
      user_id, company_id, role, portal_role,
      first_name, last_name, display_name
    ) VALUES (
      auth.uid(), invite_row.company_id, 'production'::public.user_role, 'client'::public.portal_role,
      COALESCE(use_first, 'Client'),
      COALESCE(use_last, 'User'),
      COALESCE(use_first, '') || ' ' || COALESCE(use_last, '')
    );
  ELSE
    UPDATE public.profiles
    SET portal_role = 'client'::public.portal_role,
        company_id  = invite_row.company_id
    WHERE user_id = auth.uid();
  END IF;

  INSERT INTO public.client_org_memberships (user_id, client_org_id)
  VALUES (auth.uid(), invite_row.client_org_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.client_portal_invites SET accepted_at = now() WHERE id = invite_row.id;

  RETURN invite_row.client_org_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_client_portal_invite(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_client_portal_invite(text, text) TO authenticated, service_role;

-- Update auto_join to route non-GLE emails with a valid invite through the client flow
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
  client_invite_exists boolean;
  use_first text := first_name;
  use_last text := last_name;
  use_role public.user_role := 'production';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  user_email := lower(auth.jwt() ->> 'email');

  SELECT company_id INTO existing_company_id
  FROM public.profiles WHERE user_id = auth.uid();
  IF existing_company_id IS NOT NULL THEN
    RETURN existing_company_id;
  END IF;

  -- If a client portal invite exists for this email, route through client flow
  SELECT EXISTS(
    SELECT 1 FROM public.client_portal_invites
    WHERE email = user_email AND accepted_at IS NULL AND expires_at > now()
  ) INTO client_invite_exists;

  IF client_invite_exists THEN
    PERFORM public.accept_client_portal_invite(first_name, last_name);
    SELECT company_id INTO existing_company_id
    FROM public.profiles WHERE user_id = auth.uid();
    RETURN existing_company_id;
  END IF;

  IF user_email IS NULL OR user_email NOT LIKE '%@greenlightexpediting.com' THEN
    RAISE EXCEPTION 'Only @greenlightexpediting.com accounts can join, or you need a client portal invite.';
  END IF;

  SELECT id INTO target_company_id FROM public.companies LIMIT 1;
  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'No company found';
  END IF;

  SELECT * INTO invite_row
  FROM public.pending_invites
  WHERE company_id = target_company_id
    AND email = user_email
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    use_role := invite_row.role;
    IF invite_row.first_name IS NOT NULL AND invite_row.first_name <> '' THEN
      use_first := invite_row.first_name;
    END IF;
    IF invite_row.last_name IS NOT NULL AND invite_row.last_name <> '' THEN
      use_last := invite_row.last_name;
    END IF;
    UPDATE public.pending_invites SET accepted_at = now() WHERE id = invite_row.id;
  END IF;

  INSERT INTO public.profiles (user_id, company_id, role, portal_role, first_name, last_name, display_name)
  VALUES (
    auth.uid(), target_company_id, use_role, 'gle_staff'::public.portal_role,
    use_first, use_last, use_first || ' ' || use_last
  );

  IF use_role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (auth.uid(), 'admin'::app_role, target_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  RETURN target_company_id;
END;
$function$;