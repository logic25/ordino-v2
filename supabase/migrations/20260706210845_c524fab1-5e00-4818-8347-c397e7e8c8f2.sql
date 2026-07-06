
DROP POLICY IF EXISTS "Comp admins can update compensation" ON public.employee_compensation;
DROP POLICY IF EXISTS "employee_compensation_delete" ON public.employee_compensation;
DROP POLICY IF EXISTS "employee_compensation_insert" ON public.employee_compensation;
DROP POLICY IF EXISTS "employee_compensation_select" ON public.employee_compensation;

CREATE POLICY "employee_compensation_select" ON public.employee_compensation
  FOR SELECT USING (is_company_member(company_id) AND is_comp_admin(auth.uid()));

CREATE POLICY "employee_compensation_insert" ON public.employee_compensation
  FOR INSERT WITH CHECK (is_company_member(company_id) AND is_comp_admin(auth.uid()));

CREATE POLICY "employee_compensation_update" ON public.employee_compensation
  FOR UPDATE USING (is_company_member(company_id) AND is_comp_admin(auth.uid()))
  WITH CHECK (is_company_member(company_id) AND is_comp_admin(auth.uid()));

CREATE POLICY "employee_compensation_delete" ON public.employee_compensation
  FOR DELETE USING (is_company_member(company_id) AND is_comp_admin(auth.uid()));

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename='employee_compensation' LOOP
    RAISE NOTICE 'policy %: cmd=%, qual=%, with_check=%', r.policyname, r.cmd, r.qual, r.with_check;
  END LOOP;
END $$;
