
-- Fix 1: Lock is_comp_admin column on profiles self-update
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND role = (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
  AND company_id = (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.user_id = auth.uid())
  AND is_comp_admin = (SELECT p.is_comp_admin FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- Fix 2: Restrict avatars bucket SELECT to same-company users (avatars are shown across the company UI)
DROP POLICY IF EXISTS "Authenticated users can read avatars" ON storage.objects;

CREATE POLICY "Company members can read avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles me
      JOIN public.profiles other ON other.company_id = me.company_id
      WHERE me.user_id = auth.uid()
        AND other.user_id::text = (storage.foldername(name))[1]
    )
  )
);

-- Verification (must appear in migration output)
SELECT policyname, cmd FROM pg_policies WHERE schemaname='public' AND tablename='profiles' ORDER BY policyname;
SELECT policyname, cmd FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname ILIKE '%avatar%' ORDER BY policyname;
