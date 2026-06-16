
-- 1. Gmail tokens: revoke client read access to access_token / refresh_token
REVOKE SELECT (access_token, refresh_token) ON public.gmail_connections FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.gmail_connections FROM anon;

-- 2. Profiles: revoke client read access to compensation / goal columns
REVOKE SELECT (hourly_rate, weekly_goal, monthly_goal, accuracy_goal) ON public.profiles FROM authenticated;
REVOKE SELECT (hourly_rate, weekly_goal, monthly_goal, accuracy_goal) ON public.profiles FROM anon;

-- 3. Beacon tables: scope admin check to caller's own company
DROP POLICY IF EXISTS "Admins can view beacon interactions" ON public.beacon_interactions;
CREATE POLICY "Admins can view beacon interactions" ON public.beacon_interactions
  FOR SELECT TO authenticated
  USING (public.is_company_admin(public.get_user_company_id()));

DROP POLICY IF EXISTS "Admins can view beacon corrections" ON public.beacon_corrections;
CREATE POLICY "Admins can view beacon corrections" ON public.beacon_corrections
  FOR SELECT TO authenticated
  USING (public.is_company_admin(public.get_user_company_id()));

DROP POLICY IF EXISTS "Admins can view beacon feedback" ON public.beacon_feedback;
CREATE POLICY "Admins can view beacon feedback" ON public.beacon_feedback
  FOR SELECT TO authenticated
  USING (public.is_company_admin(public.get_user_company_id()));

DROP POLICY IF EXISTS "Admins can view beacon api usage" ON public.beacon_api_usage;
CREATE POLICY "Admins can view beacon api usage" ON public.beacon_api_usage
  FOR SELECT TO authenticated
  USING (public.is_company_admin(public.get_user_company_id()));

-- 4. user_roles: replace non-company-scoped admin function with company-scoped check
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view company roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY "Admins can view company roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_company_admin(company_id));

-- 5. employee_reviews: drop self-view; salary/raise data is admin-only
DROP POLICY IF EXISTS "Admins or reviewed employee can view reviews" ON public.employee_reviews;
CREATE POLICY "Admins can view employee reviews" ON public.employee_reviews
  FOR SELECT TO authenticated
  USING (public.is_company_admin(company_id));

-- 6. bd_memberships: restrict to admins only (login credentials)
DROP POLICY IF EXISTS "Company members manage bd_memberships" ON public.bd_memberships;
CREATE POLICY "Admins manage bd_memberships" ON public.bd_memberships
  FOR ALL TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));
