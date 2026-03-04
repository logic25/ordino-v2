-- Fix 1: Function search path for seed_document_folders
ALTER FUNCTION public.seed_document_folders(uuid) SET search_path = public;

-- Fix 2: Restrict beacon_* tables - change from public role to service_role only
DROP POLICY IF EXISTS "Service role full access" ON public.beacon_api_usage;
CREATE POLICY "Service role full access" ON public.beacon_api_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.beacon_corrections;
CREATE POLICY "Service role full access" ON public.beacon_corrections FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.beacon_feedback;
CREATE POLICY "Service role full access" ON public.beacon_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.beacon_interactions;
CREATE POLICY "Service role full access" ON public.beacon_interactions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.beacon_suggestions;
CREATE POLICY "Service role full access" ON public.beacon_suggestions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.gchat_spaces_cache;
CREATE POLICY "Service role full access" ON public.gchat_spaces_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Fix 3: Restrict public SELECT on profiles to token-linked profiles only
DROP POLICY IF EXISTS "Public can view basic profile info" ON public.profiles;
CREATE POLICY "Public can view basic profile info" ON public.profiles 
  FOR SELECT TO anon 
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals WHERE proposals.public_token IS NOT NULL 
      AND (proposals.assigned_pm_id = profiles.id OR proposals.sales_person_id = profiles.id OR proposals.created_by = profiles.id)
    )
    OR EXISTS (
      SELECT 1 FROM public.change_orders WHERE change_orders.public_token IS NOT NULL
      AND (change_orders.created_by = profiles.id OR change_orders.internal_signed_by = profiles.id)
    )
  );

-- Fix 4: Restrict public SELECT on companies to token-linked only
DROP POLICY IF EXISTS "Public can view company info" ON public.companies;
CREATE POLICY "Public can view company info via token" ON public.companies 
  FOR SELECT TO anon 
  USING (
    id IN (SELECT company_id FROM public.proposals WHERE public_token IS NOT NULL)
    OR id IN (SELECT company_id FROM public.change_orders WHERE public_token IS NOT NULL)
    OR id IN (SELECT company_id FROM public.rfi_requests WHERE status IN ('draft', 'sent'))
  );

-- Fix 5: Restrict proposal_contacts public SELECT
DROP POLICY IF EXISTS "Public can view proposal contacts" ON public.proposal_contacts;
CREATE POLICY "Public can view proposal contacts via token" ON public.proposal_contacts
  FOR SELECT TO public
  USING (
    EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_contacts.proposal_id AND p.public_token IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_contacts.proposal_id AND is_company_member(p.company_id))
  );

-- Fix 6: Restrict proposal_items public SELECT
DROP POLICY IF EXISTS "Public can view proposal items for public proposals" ON public.proposal_items;
CREATE POLICY "Public can view proposal items via token" ON public.proposal_items
  FOR SELECT TO public
  USING (
    EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_items.proposal_id AND p.public_token IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_items.proposal_id AND is_company_member(p.company_id))
  );

-- Fix 7: Restrict rfi_requests public SELECT to token-based only
DROP POLICY IF EXISTS "Public can view rfi by access token" ON public.rfi_requests;
CREATE POLICY "Public can view rfi by access token" ON public.rfi_requests
  FOR SELECT TO public
  USING (access_token IS NOT NULL AND status IN ('draft', 'sent', 'submitted'));

-- Fix 8: Restrict anon notifications INSERT to specific types
DROP POLICY IF EXISTS "Public pages can create notifications" ON public.notifications;
CREATE POLICY "Public pages can create notifications" ON public.notifications
  FOR INSERT TO anon
  WITH CHECK (type IN ('proposal_signed', 'co_client_signed', 'pis_submitted', 'deposit_paid'));