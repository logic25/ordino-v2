DROP POLICY IF EXISTS "Admins/managers can view overrides in their company" ON public.beacon_kb_folder_overrides;
DROP POLICY IF EXISTS "Admins/managers can create overrides in their company" ON public.beacon_kb_folder_overrides;
DROP POLICY IF EXISTS "Admins/managers can update overrides in their company" ON public.beacon_kb_folder_overrides;
DROP POLICY IF EXISTS "Admins/managers can delete overrides in their company" ON public.beacon_kb_folder_overrides;

CREATE POLICY "Admins/managers can view overrides in their company"
ON public.beacon_kb_folder_overrides FOR SELECT TO authenticated
USING (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND (public.has_role(company_id, 'admin'::user_role) OR public.has_role(company_id, 'manager'::user_role))
);

CREATE POLICY "Admins/managers can create overrides in their company"
ON public.beacon_kb_folder_overrides FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND (public.has_role(company_id, 'admin'::user_role) OR public.has_role(company_id, 'manager'::user_role))
);

CREATE POLICY "Admins/managers can update overrides in their company"
ON public.beacon_kb_folder_overrides FOR UPDATE TO authenticated
USING (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND (public.has_role(company_id, 'admin'::user_role) OR public.has_role(company_id, 'manager'::user_role))
)
WITH CHECK (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND (public.has_role(company_id, 'admin'::user_role) OR public.has_role(company_id, 'manager'::user_role))
);

CREATE POLICY "Admins/managers can delete overrides in their company"
ON public.beacon_kb_folder_overrides FOR DELETE TO authenticated
USING (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND (public.has_role(company_id, 'admin'::user_role) OR public.has_role(company_id, 'manager'::user_role))
);

SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'beacon_kb_folder_overrides';