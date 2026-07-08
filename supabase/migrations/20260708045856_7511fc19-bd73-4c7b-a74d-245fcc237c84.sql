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
      first_name, last_name, display_name,
      is_active, onboarding_completed
    ) VALUES (
      auth.uid(), invite_row.company_id, 'production'::public.user_role, 'client'::public.portal_role,
      COALESCE(use_first, 'Client'),
      COALESCE(use_last, 'User'),
      trim(COALESCE(use_first, '') || ' ' || COALESCE(use_last, '')),
      true, true
    );
  ELSE
    UPDATE public.profiles
    SET portal_role = 'client'::public.portal_role,
        company_id  = invite_row.company_id,
        is_active = true,
        onboarding_completed = true,
        first_name = COALESCE(NULLIF(first_name, ''), COALESCE(use_first, 'Client')),
        last_name = COALESCE(NULLIF(last_name, ''), COALESCE(use_last, 'User')),
        display_name = COALESCE(NULLIF(display_name, ''), trim(COALESCE(use_first, '') || ' ' || COALESCE(use_last, '')))
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

UPDATE public.profiles p
SET is_active = true,
    onboarding_completed = true,
    portal_role = 'client'::public.portal_role
WHERE p.portal_role = 'client'::public.portal_role
  AND EXISTS (
    SELECT 1
    FROM public.client_org_memberships m
    JOIN public.client_portal_invites i ON i.client_org_id = m.client_org_id
    WHERE m.user_id = p.user_id
      AND i.accepted_at IS NOT NULL
  );

INSERT INTO public.changelog_entries (company_id, title, description, tag)
SELECT c.id,
       'Client portal invite acceptance fixed',
       'Accepted client portal invites now activate the client profile immediately so invite links open the portal instead of showing an invite mismatch error.',
       'fix'
FROM public.companies c
ORDER BY c.created_at NULLS LAST
LIMIT 1;