-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Company isolation" ON public.companies;

-- Create PERMISSIVE insert policy for new company creation
CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create SELECT policy for company members
CREATE POLICY "Company members can view their company"
ON public.companies
FOR SELECT
TO authenticated
USING (is_company_member(id));

-- Create UPDATE policy for company admins
CREATE POLICY "Admins can update their company"
ON public.companies
FOR UPDATE
TO authenticated
USING (is_company_admin(id));

-- Create DELETE policy for company admins (if needed)
CREATE POLICY "Admins can delete their company"
ON public.companies
FOR DELETE
TO authenticated
USING (is_company_admin(id));