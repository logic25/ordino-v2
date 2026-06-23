DROP POLICY IF EXISTS "Users can manage their company notification prefs" ON public.billing_notification_preferences;

CREATE POLICY "Users manage own notification prefs"
  ON public.billing_notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage company notification prefs"
  ON public.billing_notification_preferences
  FOR ALL TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY "Admins can view beacon api usage"
  ON public.beacon_api_usage
  FOR SELECT TO authenticated
  USING (public.is_company_admin(public.get_user_company_id()));

SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('billing_notification_preferences','beacon_api_usage')
ORDER BY tablename, cmd, policyname;