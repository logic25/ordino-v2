ALTER TABLE public.objection_items ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'real';

CREATE TABLE public.decision_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  objection_id uuid REFERENCES public.objection_items(id) ON DELETE SET NULL,
  objection_text text NOT NULL,
  code_reference text,
  filing_type text,
  recommendation text,
  reasoning text,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending_review',
  source text NOT NULL DEFAULT 'objection-resolution',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_records TO authenticated;
GRANT ALL ON public.decision_records TO service_role;

ALTER TABLE public.decision_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view decision records"
  ON public.decision_records FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Company members can create decision records"
  ON public.decision_records FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Company members can update decision records"
  ON public.decision_records FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Company members can delete decision records"
  ON public.decision_records FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE INDEX idx_decision_records_company_code ON public.decision_records (company_id, code_reference);
CREATE INDEX idx_decision_records_resolved_at ON public.decision_records (resolved_at DESC);

CREATE TRIGGER update_decision_records_updated_at
  BEFORE UPDATE ON public.decision_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();