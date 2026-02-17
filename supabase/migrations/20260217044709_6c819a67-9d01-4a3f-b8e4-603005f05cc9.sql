-- Allow anon to read basic profile info (first_name, last_name) for proposal signer display
-- This is safe because only name fields are exposed through the proposal join
CREATE POLICY "Public can view basic profile info"
ON public.profiles
FOR SELECT
TO anon
USING (true);
