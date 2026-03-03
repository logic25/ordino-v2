
-- Create filing_audit_log table for PM accountability
CREATE TABLE public.filing_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  initiated_by uuid NOT NULL REFERENCES public.profiles(id),
  filing_type text NOT NULL,
  work_types text[] DEFAULT '{}',
  property_address text,
  method text NOT NULL DEFAULT 'clipboard',
  payload_snapshot jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.filing_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view filing logs from their own company
CREATE POLICY "Users can view own company filing logs"
  ON public.filing_audit_log FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

-- Users can insert filing logs for their own company
CREATE POLICY "Users can insert own company filing logs"
  ON public.filing_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_member(company_id));

-- Index for fast lookups by service
CREATE INDEX idx_filing_audit_log_service ON public.filing_audit_log(service_id);
CREATE INDEX idx_filing_audit_log_project ON public.filing_audit_log(project_id);
