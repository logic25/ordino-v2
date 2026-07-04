-- Remove the real self-ownership UPDATE policy left behind by the prior migration.
-- The actual policy name in pg_policies is "employee_compensation_update" (from 20260617174814).
-- The prior lock migration dropped a guessed name and was a no-op; the comp-admin-only
-- policy "Comp admins can update compensation" already exists and is sufficient.
DROP POLICY IF EXISTS "employee_compensation_update" ON public.employee_compensation;