-- Allow public (anon) read access to companies for client-facing proposal pages
CREATE POLICY "Public can view company info"
ON public.companies
FOR SELECT
TO anon
USING (true);