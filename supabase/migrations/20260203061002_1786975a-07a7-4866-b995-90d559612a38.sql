-- Allow authenticated users to create companies (for initial signup)
CREATE POLICY "Authenticated users can create companies" ON public.companies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to create their own profile during signup
-- (They need to be able to insert with their own user_id)
CREATE POLICY "Users can create own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());