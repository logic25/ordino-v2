-- Make bootstrap_company idempotent: if user already has a profile, just return their company_id
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
  existing_company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has a profile (idempotency check)
  SELECT company_id INTO existing_company_id
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF existing_company_id IS NOT NULL THEN
    -- Already set up, just return existing company
    RETURN existing_company_id;
  END IF;

  -- Create new company
  INSERT INTO public.companies (name, slug)
  VALUES (company_name, company_slug)
  RETURNING id INTO new_company_id;

  -- Create profile
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