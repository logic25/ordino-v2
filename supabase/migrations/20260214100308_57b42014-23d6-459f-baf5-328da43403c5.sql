
-- Drop the existing overly restrictive SELECT policy
DROP POLICY "Users can view own attendance logs" ON public.attendance_logs;

-- Replace with: all active company members can see each other's attendance
CREATE POLICY "Company members can view attendance logs"
  ON public.attendance_logs FOR SELECT
  USING (public.is_company_member(company_id));
