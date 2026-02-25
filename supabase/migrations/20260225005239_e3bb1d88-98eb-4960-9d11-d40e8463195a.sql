CREATE POLICY "Users can read own cache"
ON public.gchat_spaces_cache
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);