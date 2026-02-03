-- Atomic onboarding helper to avoid client-side multi-step inserts getting blocked by RLS
-- Creates a company + the user's profile in one transaction.

CREATE OR REPLACE FUNCTION public.bootstrap_company(
  company_name text,
  company_slug text,
  first_name text,
  last_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.companies (name, slug)
  VALUES (company_name, company_slug)
  RETURNING id INTO new_company_id;

  INSERT INTO public.profiles (user_id, company_id, role, first_name, last_name, display_name)
  VALUES (
    auth.uid(),
    new_company_id,
    'admin'::user_role,
    first_name,
    last_name,
    first_name || ' ' || last_name
  );

  RETURN new_company_id;
END;
$$;

-- Allow logged-in users to call it
REVOKE ALL ON FUNCTION public.bootstrap_company(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_company(text, text, text, text) TO authenticated;