
-- Extend RLS on beacon_suggestions / beacon_feedback / beacon_interactions
-- to admin OR manager in the same company. Service-role policies untouched.

-- ── beacon_feedback ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins view own-company beacon feedback" ON public.beacon_feedback;

CREATE POLICY "Admins or managers view own-company beacon feedback"
ON public.beacon_feedback
FOR SELECT
USING (
  (public.is_company_admin(public.get_user_company_id())
   OR public.has_role(auth.uid(), 'manager'))
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id::text = beacon_feedback.user_id
      AND p.company_id = public.get_user_company_id()
  )
);

-- managers also need UPDATE to mark feedback resolved
CREATE POLICY "Admins or managers update own-company beacon feedback"
ON public.beacon_feedback
FOR UPDATE
USING (
  (public.is_company_admin(public.get_user_company_id())
   OR public.has_role(auth.uid(), 'manager'))
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id::text = beacon_feedback.user_id
      AND p.company_id = public.get_user_company_id()
  )
)
WITH CHECK (
  (public.is_company_admin(public.get_user_company_id())
   OR public.has_role(auth.uid(), 'manager'))
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id::text = beacon_feedback.user_id
      AND p.company_id = public.get_user_company_id()
  )
);

-- ── beacon_suggestions ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins read own-company beacon suggestions" ON public.beacon_suggestions;
DROP POLICY IF EXISTS "Admins review own-company beacon suggestions" ON public.beacon_suggestions;

CREATE POLICY "Admins or managers read own-company beacon suggestions"
ON public.beacon_suggestions
FOR SELECT
USING (
  (public.is_company_admin(public.get_user_company_id())
   OR public.has_role(auth.uid(), 'manager'))
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id::text = beacon_suggestions.user_id
      AND p.company_id = public.get_user_company_id()
  )
);

CREATE POLICY "Admins or managers review own-company beacon suggestions"
ON public.beacon_suggestions
FOR UPDATE
USING (
  (public.is_company_admin(public.get_user_company_id())
   OR public.has_role(auth.uid(), 'manager'))
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id::text = beacon_suggestions.user_id
      AND p.company_id = public.get_user_company_id()
  )
)
WITH CHECK (
  (public.is_company_admin(public.get_user_company_id())
   OR public.has_role(auth.uid(), 'manager'))
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id::text = beacon_suggestions.user_id
      AND p.company_id = public.get_user_company_id()
  )
);

-- ── beacon_interactions ─────────────────────────────────────────────
-- BeaconKbGaps already reads this client-side; needed for managers too.
DROP POLICY IF EXISTS "Admins view own-company beacon interactions" ON public.beacon_interactions;

CREATE POLICY "Admins or managers view own-company beacon interactions"
ON public.beacon_interactions
FOR SELECT
USING (
  (public.is_company_admin(public.get_user_company_id())
   OR public.has_role(auth.uid(), 'manager'))
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id::text = beacon_interactions.user_id
      AND p.company_id = public.get_user_company_id()
  )
);

-- BeaconKbGaps also needs UPDATE to set addressed_at on dismissed gaps.
CREATE POLICY "Admins or managers update own-company beacon interactions"
ON public.beacon_interactions
FOR UPDATE
USING (
  (public.is_company_admin(public.get_user_company_id())
   OR public.has_role(auth.uid(), 'manager'))
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id::text = beacon_interactions.user_id
      AND p.company_id = public.get_user_company_id()
  )
)
WITH CHECK (
  (public.is_company_admin(public.get_user_company_id())
   OR public.has_role(auth.uid(), 'manager'))
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id::text = beacon_interactions.user_id
      AND p.company_id = public.get_user_company_id()
  )
);

-- Verify
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('beacon_suggestions','beacon_feedback','beacon_interactions')
ORDER BY tablename, policyname;
