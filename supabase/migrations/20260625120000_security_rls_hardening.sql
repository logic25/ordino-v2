-- Security hardening: RLS tenant-isolation fixes
-- Companion to the edge-function auth patches in the same branch.
--
-- Addresses three classes of issue surfaced in the post-Lovable deep scan:
--   1. profiles.id vs auth.uid() confusion → policies that never match (deny-all),
--      same class Lovable just fixed for notifications INSERT. Here: notifications
--      SELECT/UPDATE and user_monthly_goals were left with the broken mapping.
--   2. UPDATE/FOR ALL policies that scope USING by company but omit WITH CHECK, so the
--      *new* row's company_id is never validated → an authenticated writer can
--      UPDATE ... SET company_id = '<other tenant>' to move a row out of their tenant.
--
-- All statements are idempotent and drift-safe (guarded against the live DB diverging
-- from committed migrations, per the known Lovable migration-drift caveat).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. notifications — fix profiles.id vs auth.uid() (currently deny-all on SELECT/UPDATE)
--    notifications.user_id REFERENCES profiles(id); auth.uid() = profiles.user_id.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. user_monthly_goals — same profiles.id confusion (June-11 regression).
--    Rewrite against the canonical helpers instead of `profiles WHERE id = auth.uid()`.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company members can view user_monthly_goals" ON public.user_monthly_goals;
CREATE POLICY "Company members can view user_monthly_goals"
  ON public.user_monthly_goals FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Admins can manage user_monthly_goals" ON public.user_monthly_goals;
CREATE POLICY "Admins can manage user_monthly_goals"
  ON public.user_monthly_goals FOR ALL TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tenant-move prevention — add WITH CHECK to company-scoped write policies that
--    only had USING. WITH CHECK (is_company_member(company_id)) pins the post-update
--    row to a company the caller belongs to, blocking SET company_id = other tenant,
--    without altering the existing USING (who may target which rows).
--    ALTER POLICY only adds the check; it leaves USING intact. Guarded so a missing
--    policy (live-DB drift) is skipped rather than failing the migration.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  i int;
  pairs text[][] := ARRAY[
    ARRAY['leads',                            'Company members can update leads'],
    ARRAY['invoices',                         'Admins managers and accounting can modify invoices'],
    ARRAY['billing_requests',                 'Admins managers and accounting can modify billing_requests'],
    ARRAY['invoice_follow_ups',               'Admins managers and accounting can modify invoice_follow_ups'],
    ARRAY['client_billing_rules',             'Admins and managers can modify client_billing_rules'],
    ARRAY['billing_schedules',                'Users can manage their company schedules'],
    ARRAY['billing_notification_preferences', 'Users can manage their company notification prefs'],
    ARRAY['billing_notification_queue',       'Users can view their company notification queue'],
    ARRAY['co_sign_offs',                     'Users can update their company sign-offs'],
    ARRAY['project_action_items',             'Company members can update action items'],
    ARRAY['project_checklist_items',          'Company members can update checklist items'],
    ARRAY['project_expenses',                 'Creator or admin/manager can update'],
    ARRAY['activities',                       'Users can update own activities'],
    ARRAY['ach_authorizations',               'Admins can update ACH authorizations'],
    ARRAY['change_orders',                    'change_orders_update'],
    ARRAY['payment_predictions',              'Company admins/managers can manage payment predictions'],
    ARRAY['client_payment_analytics',         'Company admins/managers can manage client analytics'],
    ARRAY['collection_tasks',                 'Company admins/managers can manage collection tasks'],
    ARRAY['payment_promises',                 'Company admins/managers can manage payment promises'],
    ARRAY['invoice_disputes',                 'Company admins/managers can manage disputes'],
    ARRAY['dispute_messages',                 'Company admins/managers can manage dispute messages'],
    ARRAY['cash_forecasts',                   'Company admins/managers can manage cash forecasts']
  ];
BEGIN
  FOR i IN 1 .. array_length(pairs, 1) LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = pairs[i][1]
        AND policyname = pairs[i][2]
    ) THEN
      EXECUTE format(
        'ALTER POLICY %I ON public.%I WITH CHECK (public.is_company_member(company_id))',
        pairs[i][2], pairs[i][1]
      );
    ELSE
      RAISE NOTICE 'skip: policy "%" on % not found (live-DB drift?)', pairs[i][2], pairs[i][1];
    END IF;
  END LOOP;
END $$;
