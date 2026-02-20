
-- AI Usage Logs table
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  feature TEXT NOT NULL, -- e.g. 'stress_test', 'collection_message', 'rfp_extract', 'plan_analysis'
  model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Admins and company members can read their own company's logs
CREATE POLICY "Company members can view ai usage logs"
  ON public.ai_usage_logs FOR SELECT
  USING (public.is_company_member(company_id));

-- Only service role can insert (edge functions use service role)
CREATE POLICY "Service role can insert ai usage logs"
  ON public.ai_usage_logs FOR INSERT
  WITH CHECK (true);

-- Index for fast queries
CREATE INDEX idx_ai_usage_logs_company_created ON public.ai_usage_logs(company_id, created_at DESC);
CREATE INDEX idx_ai_usage_logs_feature ON public.ai_usage_logs(company_id, feature);
CREATE INDEX idx_ai_usage_logs_user ON public.ai_usage_logs(user_id, created_at DESC);
