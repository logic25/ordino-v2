-- Create a SECURITY DEFINER function to check if a company has public proposals/COs
-- This bypasses RLS on the proposals table when used in the companies RLS policy
CREATE OR REPLACE FUNCTION public.has_public_token(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.proposals WHERE company_id = target_company_id AND public_token IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.change_orders WHERE company_id = target_company_id AND public_token IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.rfi_requests WHERE company_id = target_company_id AND status IN ('draft', 'sent')
  )
$$;

-- Replace the companies anon policy to use the SECURITY DEFINER function
DROP POLICY IF EXISTS "Public can view company info via token" ON public.companies;
DROP POLICY IF EXISTS "anon_read_company_via_co" ON public.companies;

CREATE POLICY "Public can view company info via token" ON public.companies
  FOR SELECT TO anon
  USING (public.has_public_token(id));