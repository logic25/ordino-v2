
-- 1) bd_memberships: add member SELECT
DROP POLICY IF EXISTS "Members can view bd_memberships" ON public.bd_memberships;
CREATE POLICY "Members can view bd_memberships"
ON public.bd_memberships
FOR SELECT
TO authenticated
USING (is_company_member(company_id));

-- 2) gchat_spaces_cache: rewrite SELECT to be explicit about profiles.id semantics
DROP POLICY IF EXISTS "Users can read own cache" ON public.gchat_spaces_cache;
CREATE POLICY "Users can read own cache"
ON public.gchat_spaces_cache
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

-- 3) notifications: tighten INSERT — require non-null company match AND target within company
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  get_user_company_id() IS NOT NULL
  AND company_id = get_user_company_id()
  AND user_id IN (
    SELECT p.id FROM public.profiles p WHERE p.company_id = get_user_company_id()
  )
);

-- Verify
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('bd_memberships','gchat_spaces_cache','notifications')
ORDER BY tablename, cmd, policyname;
