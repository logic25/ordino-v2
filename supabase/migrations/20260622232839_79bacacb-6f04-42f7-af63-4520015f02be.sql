
DROP POLICY IF EXISTS "Admins can view beacon interactions" ON public.beacon_interactions;
CREATE POLICY "Admins view own-company beacon interactions"
  ON public.beacon_interactions FOR SELECT
  USING (
    public.is_company_admin(public.get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id::text = beacon_interactions.user_id
        AND p.company_id = public.get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "Admins can view beacon feedback" ON public.beacon_feedback;
CREATE POLICY "Admins view own-company beacon feedback"
  ON public.beacon_feedback FOR SELECT
  USING (
    public.is_company_admin(public.get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id::text = beacon_feedback.user_id
        AND p.company_id = public.get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "Admins can view beacon corrections" ON public.beacon_corrections;
CREATE POLICY "Admins view own-company beacon corrections"
  ON public.beacon_corrections FOR SELECT
  USING (
    public.is_company_admin(public.get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id::text = beacon_corrections.user_id
        AND p.company_id = public.get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "Admins read beacon suggestions" ON public.beacon_suggestions;
DROP POLICY IF EXISTS "Admins review beacon suggestions" ON public.beacon_suggestions;
CREATE POLICY "Admins read own-company beacon suggestions"
  ON public.beacon_suggestions FOR SELECT
  USING (
    public.is_company_admin(public.get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id::text = beacon_suggestions.user_id
        AND p.company_id = public.get_user_company_id()
    )
  );
CREATE POLICY "Admins review own-company beacon suggestions"
  ON public.beacon_suggestions FOR UPDATE
  USING (
    public.is_company_admin(public.get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id::text = beacon_suggestions.user_id
        AND p.company_id = public.get_user_company_id()
    )
  )
  WITH CHECK (
    public.is_company_admin(public.get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id::text = beacon_suggestions.user_id
        AND p.company_id = public.get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "Admins can view beacon api usage" ON public.beacon_api_usage;

SELECT tablename, policyname, cmd, qual FROM pg_policies
WHERE schemaname='public' AND tablename IN
('beacon_interactions','beacon_feedback','beacon_corrections','beacon_suggestions','beacon_api_usage')
ORDER BY tablename, cmd, policyname;
