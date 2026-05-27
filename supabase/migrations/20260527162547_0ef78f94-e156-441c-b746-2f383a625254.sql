
-- Fix RLS policies using profiles.id = auth.uid() (wrong) → use get_user_company_id() helper which correctly resolves via profiles.user_id = auth.uid()

-- ach_authorizations
DROP POLICY IF EXISTS "Users can create ACH authorizations for their company" ON public.ach_authorizations;
CREATE POLICY "Users can create ACH authorizations for their company"
  ON public.ach_authorizations FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

-- activity_edit_logs
DROP POLICY IF EXISTS "Users can insert edit logs for their company" ON public.activity_edit_logs;
CREATE POLICY "Users can insert edit logs for their company"
  ON public.activity_edit_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can view edit logs for their company" ON public.activity_edit_logs;
CREATE POLICY "Users can view edit logs for their company"
  ON public.activity_edit_logs FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

-- lead_statuses
DROP POLICY IF EXISTS "Users can delete non-system lead statuses" ON public.lead_statuses;
CREATE POLICY "Users can delete non-system lead statuses"
  ON public.lead_statuses FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id() AND is_system = false);

DROP POLICY IF EXISTS "Users can insert lead statuses" ON public.lead_statuses;
CREATE POLICY "Users can insert lead statuses"
  ON public.lead_statuses FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can update lead statuses" ON public.lead_statuses;
CREATE POLICY "Users can update lead statuses"
  ON public.lead_statuses FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can view their company lead statuses" ON public.lead_statuses;
CREATE POLICY "Users can view their company lead statuses"
  ON public.lead_statuses FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

-- notifications
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

-- pis_tracking
DROP POLICY IF EXISTS "Users can insert pis_tracking in their company" ON public.pis_tracking;
CREATE POLICY "Users can insert pis_tracking in their company"
  ON public.pis_tracking FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can update pis_tracking in their company" ON public.pis_tracking;
CREATE POLICY "Users can update pis_tracking in their company"
  ON public.pis_tracking FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can view pis_tracking in their company" ON public.pis_tracking;
CREATE POLICY "Users can view pis_tracking in their company"
  ON public.pis_tracking FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

-- proposal_follow_ups
DROP POLICY IF EXISTS "Users can delete follow-ups for their company" ON public.proposal_follow_ups;
CREATE POLICY "Users can delete follow-ups for their company"
  ON public.proposal_follow_ups FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can insert follow-ups for their company" ON public.proposal_follow_ups;
CREATE POLICY "Users can insert follow-ups for their company"
  ON public.proposal_follow_ups FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can view follow-ups for their company" ON public.proposal_follow_ups;
CREATE POLICY "Users can view follow-ups for their company"
  ON public.proposal_follow_ups FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
