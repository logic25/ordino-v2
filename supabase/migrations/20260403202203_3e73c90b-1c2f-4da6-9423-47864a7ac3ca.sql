
-- =====================================================
-- 1. Gmail Connections: restrict SELECT to own user only
-- =====================================================

DROP POLICY IF EXISTS "Company members can view gmail connections" ON public.gmail_connections;

CREATE POLICY "Users can view own gmail connection"
  ON public.gmail_connections FOR SELECT
  USING (
    user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    AND public.is_company_member(company_id)
  );

-- =====================================================
-- 2. Beacon tables: remove overly permissive policies
-- These are service-role-written analytics tables
-- =====================================================

-- beacon_interactions
DROP POLICY IF EXISTS "Authenticated users can read interactions" ON public.beacon_interactions;
DROP POLICY IF EXISTS "Authenticated users can view interactions" ON public.beacon_interactions;

-- beacon_feedback
DROP POLICY IF EXISTS "Authenticated users can read feedback" ON public.beacon_feedback;
DROP POLICY IF EXISTS "Authenticated users can view feedback" ON public.beacon_feedback;

-- beacon_api_usage
DROP POLICY IF EXISTS "Authenticated users can read api usage" ON public.beacon_api_usage;
DROP POLICY IF EXISTS "Authenticated users can view api usage" ON public.beacon_api_usage;

-- beacon_corrections
DROP POLICY IF EXISTS "Authenticated users can read corrections" ON public.beacon_corrections;
DROP POLICY IF EXISTS "Authenticated users can view corrections" ON public.beacon_corrections;

-- beacon_suggestions
DROP POLICY IF EXISTS "Authenticated users can read suggestions" ON public.beacon_suggestions;
DROP POLICY IF EXISTS "Authenticated users can view suggestions" ON public.beacon_suggestions;

-- Admin-only read access for beacon analytics tables (for admin dashboard)
CREATE POLICY "Admins can view beacon interactions"
  ON public.beacon_interactions FOR SELECT
  USING (public.has_app_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view beacon feedback"
  ON public.beacon_feedback FOR SELECT
  USING (public.has_app_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view beacon api usage"
  ON public.beacon_api_usage FOR SELECT
  USING (public.has_app_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view beacon corrections"
  ON public.beacon_corrections FOR SELECT
  USING (public.has_app_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view beacon suggestions"
  ON public.beacon_suggestions FOR SELECT
  USING (public.has_app_role(auth.uid(), 'admin'));

-- =====================================================
-- 3. Universal Documents storage: scope to company
-- =====================================================

DROP POLICY IF EXISTS "Company members can read universal docs" ON storage.objects;

CREATE POLICY "Company members can read own company universal docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'universal-documents'
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
  );
