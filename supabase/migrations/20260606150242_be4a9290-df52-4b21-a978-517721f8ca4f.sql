
CREATE TABLE public.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.project_notes(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  correction_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_feedback TO authenticated;
GRANT ALL ON public.ai_feedback TO service_role;

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view ai_feedback"
  ON public.ai_feedback FOR SELECT TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Members can insert ai_feedback"
  ON public.ai_feedback FOR INSERT TO authenticated
  WITH CHECK (is_company_member(company_id) AND user_id = auth.uid());

CREATE POLICY "Authors or admins can delete ai_feedback"
  ON public.ai_feedback FOR DELETE TO authenticated
  USING (is_company_member(company_id) AND (user_id = auth.uid() OR is_company_admin(company_id)));

CREATE INDEX idx_ai_feedback_project ON public.ai_feedback(project_id, created_at DESC);
