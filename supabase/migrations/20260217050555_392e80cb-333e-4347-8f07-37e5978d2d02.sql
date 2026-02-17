-- Allow anon to read properties that are linked to a proposal with a public_token
CREATE POLICY "Public can view properties linked to public proposals"
ON public.properties
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.proposals
    WHERE proposals.property_id = properties.id
    AND proposals.public_token IS NOT NULL
  )
);

-- Also allow anon to read profiles for internal signer info on public proposals
-- (policy may already exist, use IF NOT EXISTS pattern via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Public can view basic profile info'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can view basic profile info" ON public.profiles FOR SELECT USING (true)';
  END IF;
END $$;