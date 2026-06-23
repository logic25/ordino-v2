
-- 1. Fix beacon_kb_folder_overrides policies: profiles.id -> profiles.user_id
DROP POLICY IF EXISTS "Admins/managers can view overrides in their company" ON public.beacon_kb_folder_overrides;
DROP POLICY IF EXISTS "Admins/managers can create overrides in their company" ON public.beacon_kb_folder_overrides;
DROP POLICY IF EXISTS "Admins/managers can update overrides in their company" ON public.beacon_kb_folder_overrides;
DROP POLICY IF EXISTS "Admins/managers can delete overrides in their company" ON public.beacon_kb_folder_overrides;

CREATE POLICY "Admins/managers can view overrides in their company"
ON public.beacon_kb_folder_overrides FOR SELECT TO authenticated
USING (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::user_role) OR public.has_role(auth.uid(), 'manager'::user_role))
);

CREATE POLICY "Admins/managers can create overrides in their company"
ON public.beacon_kb_folder_overrides FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::user_role) OR public.has_role(auth.uid(), 'manager'::user_role))
);

CREATE POLICY "Admins/managers can update overrides in their company"
ON public.beacon_kb_folder_overrides FOR UPDATE TO authenticated
USING (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::user_role) OR public.has_role(auth.uid(), 'manager'::user_role))
)
WITH CHECK (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::user_role) OR public.has_role(auth.uid(), 'manager'::user_role))
);

CREATE POLICY "Admins/managers can delete overrides in their company"
ON public.beacon_kb_folder_overrides FOR DELETE TO authenticated
USING (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::user_role) OR public.has_role(auth.uid(), 'manager'::user_role))
);

-- 2. Tighten notifications INSERT to validate target user belongs to same company
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (
    user_id = auth.uid()
    OR user_id IN (SELECT p.id FROM public.profiles p WHERE p.company_id = public.get_user_company_id())
    OR user_id IN (SELECT p.user_id FROM public.profiles p WHERE p.company_id = public.get_user_company_id())
  )
);

-- 3. Allow invited users to read their own pending invite by JWT email
CREATE POLICY "Invitees can view their own pending invite"
ON public.pending_invites FOR SELECT TO authenticated
USING (lower(email) = lower(coalesce((auth.jwt() ->> 'email')::text, '')));

-- Verification
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('beacon_kb_folder_overrides','notifications','pending_invites')
ORDER BY tablename, policyname;
