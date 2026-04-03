
-- =====================================================
-- 1. ACH Authorizations: restrict SELECT/UPDATE/DELETE to admin only
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view ACH authorizations for their company" ON public.ach_authorizations;
DROP POLICY IF EXISTS "Users can update ACH authorizations for their company" ON public.ach_authorizations;

-- Admin-only SELECT
CREATE POLICY "Admins can view ACH authorizations"
  ON public.ach_authorizations FOR SELECT
  USING (public.is_company_admin(company_id));

-- Admin-only UPDATE
CREATE POLICY "Admins can update ACH authorizations"
  ON public.ach_authorizations FOR UPDATE
  USING (public.is_company_admin(company_id));

-- Admin-only DELETE
CREATE POLICY "Admins can delete ACH authorizations"
  ON public.ach_authorizations FOR DELETE
  USING (public.is_company_admin(company_id));

-- =====================================================
-- 2. QBO Connections: restrict SELECT to admin only
-- =====================================================

DROP POLICY IF EXISTS "Company isolation for qbo_connections" ON public.qbo_connections;

CREATE POLICY "Admins can view qbo_connections"
  ON public.qbo_connections FOR SELECT
  USING (public.is_company_admin(company_id));

-- =====================================================
-- 3. Employee Reviews: restrict SELECT to admin + reviewed employee
-- =====================================================

DROP POLICY IF EXISTS "Company members can view employee reviews" ON public.employee_reviews;

CREATE POLICY "Admins or reviewed employee can view reviews"
  ON public.employee_reviews FOR SELECT
  USING (
    public.is_company_admin(company_id)
    OR employee_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  );

-- =====================================================
-- 4. Widget Messages: add company_id for tenant isolation
-- =====================================================

-- Add company_id column
ALTER TABLE public.widget_messages ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_widget_messages_company_id ON public.widget_messages(company_id);

-- Drop old policies
DROP POLICY IF EXISTS "Users can read own messages" ON public.widget_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.widget_messages;
DROP POLICY IF EXISTS "Users can soft-delete own widget messages" ON public.widget_messages;

-- New policies with company isolation
CREATE POLICY "Users can read own messages"
  ON public.widget_messages FOR SELECT
  USING (
    (auth.jwt() ->> 'email') = user_email
    AND (company_id IS NULL OR public.is_company_member(company_id))
  );

CREATE POLICY "Users can insert own messages"
  ON public.widget_messages FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'email') = user_email
    AND (company_id IS NULL OR public.is_company_member(company_id))
  );

CREATE POLICY "Users can soft-delete own messages"
  ON public.widget_messages FOR UPDATE
  USING (
    user_email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
    AND (company_id IS NULL OR public.is_company_member(company_id))
  )
  WITH CHECK (
    user_email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
    AND (company_id IS NULL OR public.is_company_member(company_id))
  );
