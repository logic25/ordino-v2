
CREATE TABLE public.bug_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id UUID NOT NULL REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  user_id UUID REFERENCES public.profiles(id),
  action_type TEXT NOT NULL,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view bug activity"
  ON public.bug_activity_logs FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert bug activity"
  ON public.bug_activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_member(company_id));

CREATE INDEX idx_bug_activity_logs_bug_id ON public.bug_activity_logs(bug_id);
