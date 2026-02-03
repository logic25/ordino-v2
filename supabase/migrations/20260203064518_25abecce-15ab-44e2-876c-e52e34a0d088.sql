-- Drop all existing policies on companies and recreate them
DROP POLICY IF EXISTS "Admins can delete their company" ON public.companies;
DROP POLICY IF EXISTS "Admins can update their company" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Company members can view their company" ON public.companies;

-- Re-grant permissions
GRANT ALL ON public.companies TO authenticated;

-- Recreate policies
-- 1. Anyone authenticated can INSERT a new company (bootstrap)
CREATE POLICY "Anyone authenticated can create company"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Company members can view their company
CREATE POLICY "Company members can view"
ON public.companies
FOR SELECT
TO authenticated
USING (is_company_member(id));

-- 3. Company admins can update
CREATE POLICY "Company admins can update"
ON public.companies
FOR UPDATE
TO authenticated
USING (is_company_admin(id));

-- 4. Company admins can delete  
CREATE POLICY "Company admins can delete"
ON public.companies
FOR DELETE
TO authenticated
USING (is_company_admin(id));