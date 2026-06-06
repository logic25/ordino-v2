
CREATE TABLE public.beacon_tool_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id uuid NOT NULL,
  project_id uuid,
  question_id uuid,
  question_text text,
  tool_name text NOT NULL,
  parameters jsonb,
  row_count integer,
  duration_ms integer,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_beacon_tool_log_company_created ON public.beacon_tool_log (company_id, created_at DESC);
CREATE INDEX idx_beacon_tool_log_question ON public.beacon_tool_log (question_id);
CREATE INDEX idx_beacon_tool_log_project ON public.beacon_tool_log (project_id) WHERE project_id IS NOT NULL;

GRANT SELECT ON public.beacon_tool_log TO authenticated;
GRANT ALL ON public.beacon_tool_log TO service_role;

ALTER TABLE public.beacon_tool_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their company's beacon tool logs"
  ON public.beacon_tool_log
  FOR SELECT
  TO authenticated
  USING (public.is_company_admin(company_id));
