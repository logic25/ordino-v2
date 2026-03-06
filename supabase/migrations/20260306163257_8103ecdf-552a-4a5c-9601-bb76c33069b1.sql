
-- Create filing_runs table
CREATE TABLE public.filing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'review_needed')),
  progress_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload_snapshot jsonb,
  agent_session_id text,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.filing_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can read filing_runs"
  ON public.filing_runs FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert filing_runs"
  ON public.filing_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update filing_runs"
  ON public.filing_runs FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.filing_runs;

-- Updated_at trigger
CREATE TRIGGER update_filing_runs_updated_at
  BEFORE UPDATE ON public.filing_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
