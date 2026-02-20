
-- Fix overly permissive INSERT policy - restrict to authenticated service role context
DROP POLICY IF EXISTS "Service role can insert ai usage logs" ON public.ai_usage_logs;

-- Edge functions running with service role bypass RLS entirely, so no INSERT policy needed for them.
-- We only need to allow authenticated users to insert their own company's logs as a fallback.
CREATE POLICY "Authenticated users can insert their company ai usage logs"
  ON public.ai_usage_logs FOR INSERT
  WITH CHECK (public.is_company_member(company_id));
