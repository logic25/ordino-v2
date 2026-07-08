CREATE OR REPLACE FUNCTION public.portal_email_has_access(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_portal_invites
    WHERE lower(email) = lower(_email)
      AND (accepted_at IS NOT NULL OR expires_at > now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.portal_email_has_access(text) TO anon, authenticated;