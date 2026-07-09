
-- 1) beacon_api_usage: add company_id and require company match on SELECT.
ALTER TABLE public.beacon_api_usage
  ADD COLUMN IF NOT EXISTS company_id uuid;

CREATE INDEX IF NOT EXISTS beacon_api_usage_company_id_idx
  ON public.beacon_api_usage(company_id);

DROP POLICY IF EXISTS "Admins can view beacon api usage" ON public.beacon_api_usage;

CREATE POLICY "Admins view own-company beacon api usage"
  ON public.beacon_api_usage
  FOR SELECT
  TO authenticated
  USING (
    is_company_admin(get_user_company_id())
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id()
  );

-- 2) beacon_interactions: harden UPDATE WITH CHECK so addressed_by must
-- equal auth.uid() (writer cannot impersonate another user), while keeping
-- existing company-scope requirement via the user_id/profile join.
DROP POLICY IF EXISTS "Admins or managers update own-company beacon interactions"
  ON public.beacon_interactions;

CREATE POLICY "Admins or managers update own-company beacon interactions"
  ON public.beacon_interactions
  FOR UPDATE
  TO authenticated
  USING (
    (is_company_admin(get_user_company_id())
      OR has_role(auth.uid(), 'manager'::user_role))
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id::text = beacon_interactions.user_id
        AND p.company_id = get_user_company_id()
    )
  )
  WITH CHECK (
    (is_company_admin(get_user_company_id())
      OR has_role(auth.uid(), 'manager'::user_role))
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id::text = beacon_interactions.user_id
        AND p.company_id = get_user_company_id()
    )
    AND (addressed_by IS NULL OR addressed_by = auth.uid())
  );

-- Verification
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('beacon_api_usage','beacon_interactions')
ORDER BY tablename, cmd, policyname;
