
CREATE TABLE public.research_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id),
  query TEXT NOT NULL,
  response TEXT,
  sources JSONB DEFAULT '[]'::jsonb,
  confidence NUMERIC,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.research_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view research notes"
  ON public.research_notes FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert research notes"
  ON public.research_notes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update research notes"
  ON public.research_notes FOR UPDATE
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can delete research notes"
  ON public.research_notes FOR DELETE
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE INDEX idx_research_notes_project ON public.research_notes(project_id);
CREATE INDEX idx_research_notes_company ON public.research_notes(company_id);
