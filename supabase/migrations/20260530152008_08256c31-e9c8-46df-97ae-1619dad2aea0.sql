-- Project Notes table: persistent manual notes + AI-generated weekly/on-demand summaries
CREATE TABLE public.project_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai_weekly', 'ai_on_demand')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_notes TO authenticated;
GRANT ALL ON public.project_notes TO service_role;

ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view project notes"
  ON public.project_notes FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can add project notes"
  ON public.project_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id) AND user_id = auth.uid());

CREATE POLICY "Authors can update their own notes"
  ON public.project_notes FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id) AND user_id = auth.uid())
  WITH CHECK (public.is_company_member(company_id) AND user_id = auth.uid());

CREATE POLICY "Authors or admins can delete notes"
  ON public.project_notes FOR DELETE TO authenticated
  USING (
    public.is_company_member(company_id)
    AND (user_id = auth.uid() OR public.is_company_admin(company_id))
  );

CREATE INDEX idx_project_notes_project ON public.project_notes(project_id, created_at DESC);
CREATE INDEX idx_project_notes_company ON public.project_notes(company_id, created_at DESC);

CREATE TRIGGER trg_project_notes_updated_at
  BEFORE UPDATE ON public.project_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();