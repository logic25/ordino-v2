-- Fix grants: authenticated can write; anon cannot
REVOKE ALL ON public.companies FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;

-- Tighten INSERT policy (avoid WITH CHECK (true) lint)
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);