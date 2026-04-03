
-- Add AI triage and fix tracking columns to feature_requests
ALTER TABLE public.feature_requests
  ADD COLUMN IF NOT EXISTS ai_severity text,
  ADD COLUMN IF NOT EXISTS ai_diagnosis text,
  ADD COLUMN IF NOT EXISTS ai_suggested_files jsonb,
  ADD COLUMN IF NOT EXISTS ai_triaged_at timestamptz,
  ADD COLUMN IF NOT EXISTS fixed_by text,
  ADD COLUMN IF NOT EXISTS fix_description text,
  ADD COLUMN IF NOT EXISTS files_changed jsonb,
  ADD COLUMN IF NOT EXISTS fix_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_time_hours numeric;

-- Create bug_patterns table
CREATE TABLE public.bug_patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pattern_name text NOT NULL,
  affected_files jsonb DEFAULT '[]'::jsonb,
  root_cause text,
  fix_pattern text,
  occurrences integer NOT NULL DEFAULT 1,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view bug patterns"
  ON public.bug_patterns FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

-- Create bug_fix_log table
CREATE TABLE public.bug_fix_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bug_report_id uuid NOT NULL REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  diagnosis text,
  fix_description text,
  files_changed jsonb DEFAULT '[]'::jsonb,
  fixed_by text,
  submitted_at timestamptz,
  fixed_at timestamptz,
  verified_at timestamptz,
  was_first_attempt boolean DEFAULT true,
  rejection_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_fix_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view bug fix logs"
  ON public.bug_fix_log FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

-- Indexes
CREATE INDEX idx_bug_patterns_company ON public.bug_patterns(company_id);
CREATE INDEX idx_bug_fix_log_company ON public.bug_fix_log(company_id);
CREATE INDEX idx_bug_fix_log_bug_report ON public.bug_fix_log(bug_report_id);
CREATE INDEX idx_feature_requests_ai_triaged ON public.feature_requests(ai_triaged_at) WHERE ai_triaged_at IS NOT NULL;
