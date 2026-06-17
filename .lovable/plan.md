## Plan

1. **Add a follow-up migration with a later timestamp**
   - Create a new migration named like `..._drop_stale_employee_comp_update_policy.sql`.
   - Include only:
     ```sql
     -- Remove the real self-ownership UPDATE policy left behind by the prior migration.
     DROP POLICY IF EXISTS "employee_compensation_update" ON public.employee_compensation;
     ```
   - Do not touch the existing `Comp admins can update compensation` policy, since it is already correct.

2. **Verify the live policy state after the migration**
   - Run:
     ```sql
     SELECT policyname, cmd, qual, with_check
     FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'employee_compensation'
       AND cmd = 'UPDATE';
     ```
   - Expected result: exactly one row, `Comp admins can update compensation`, with both `qual` and `with_check` equal to `is_comp_admin(auth.uid())`.

3. **Smoke-test the exploit path**
   - Confirm `set_my_hourly_rate` is already gone.
   - Test a direct non-admin `.update({ hourly_rate })` against that user’s own `employee_compensation` row and verify it fails with an RLS denial.
   - Confirm the admin write path remains through `upsert_employee_hourly_rate`.

4. **No frontend edits in this follow-up**
   - The Profile Settings editable hourly-rate path was already removed; this migration only closes the stale RLS policy hole.