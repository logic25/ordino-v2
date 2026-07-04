-- Security hardening: RLS tenant-isolation fixes
-- Companion to the send-bug-alert cross-tenant fix in the same branch.
--
-- Scoped to what the concurrent main-branch RLS hardening has NOT already covered
-- (notifications SELECT, user_monthly_goals, and billing_notification_preferences are
-- deliberately excluded — main already fixed those; re-touching them here would either
-- be redundant or regress a policy main intentionally narrowed).
--
-- Follows docs/security-migrations.md: policy names below were read from the actual
-- CREATE POLICY statements (not guessed from labels); a pg_policies dump is appended.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. notifications UPDATE — still deny-all on main.
--    notifications.user_id REFERENCES profiles(id), but the policy compares it to
--    auth.uid() (= profiles.user_id, a different value) so it never matches and no
--    user can mark a notification read/dismissed. main's 20260626012030 fixed SELECT
--    but left UPDATE on the broken 20260613024212 definition. Mirror main's SELECT form.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1))
  WITH CHECK (user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tenant-move prevention — company-scoped write policies that have USING but no
--    WITH CHECK let an authenticated writer do UPDATE ... SET company_id = '<other
--    tenant>' (the new row's company is never validated). Add
--    WITH CHECK (is_company_member(company_id)) via ALTER POLICY, which leaves USING
--    (who may target which rows) untouched. Guarded so a policy absent from the live
--    DB is skipped rather than failing the migration (live-DB drift is a known risk).
--    Excludes billing_notification_preferences — main re-policied it with WITH CHECK.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  i int;
  pairs text[][] := ARRAY[
    ARRAY['leads',                       'Company members can update leads'],
    ARRAY['invoices',                    'Admins managers and accounting can modify invoices'],
    ARRAY['billing_requests',            'Admins managers and accounting can modify billing_requests'],
    ARRAY['invoice_follow_ups',          'Admins managers and accounting can modify invoice_follow_ups'],
    ARRAY['client_billing_rules',        'Admins and managers can modify client_billing_rules'],
    ARRAY['billing_schedules',           'Users can manage their company schedules'],
    ARRAY['billing_notification_queue',  'Users can view their company notification queue'],
    ARRAY['co_sign_offs',                'Users can update their company sign-offs'],
    ARRAY['project_action_items',        'Company members can update action items'],
    ARRAY['project_checklist_items',     'Company members can update checklist items'],
    ARRAY['project_expenses',            'Creator or admin/manager can update'],
    ARRAY['activities',                  'Users can update own activities'],
    ARRAY['ach_authorizations',          'Admins can update ACH authorizations'],
    ARRAY['change_orders',               'change_orders_update'],
    ARRAY['payment_predictions',         'Company admins/managers can manage payment predictions'],
    ARRAY['client_payment_analytics',    'Company admins/managers can manage client analytics'],
    ARRAY['collection_tasks',            'Company admins/managers can manage collection tasks'],
    ARRAY['payment_promises',            'Company admins/managers can manage payment promises'],
    ARRAY['invoice_disputes',            'Company admins/managers can manage disputes'],
    ARRAY['dispute_messages',            'Company admins/managers can manage dispute messages'],
    ARRAY['cash_forecasts',              'Company admins/managers can manage cash forecasts']
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

-- ── Post-state (per docs/security-migrations.md): confirm the write policies now
--    carry a with_check body and notifications UPDATE maps to profiles.id.
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (tablename = 'notifications' AND cmd = 'UPDATE')
    OR (tablename, policyname) IN (
      ('leads','Company members can update leads'),
      ('invoices','Admins managers and accounting can modify invoices'),
      ('change_orders','change_orders_update'),
      ('ach_authorizations','Admins can update ACH authorizations')
    )
  )
ORDER BY tablename, policyname;
