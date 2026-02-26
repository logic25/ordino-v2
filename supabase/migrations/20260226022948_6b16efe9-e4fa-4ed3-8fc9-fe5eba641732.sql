
-- Join table to link contacts (from any company) to a project
CREATE TABLE public.project_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.client_contacts(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  role TEXT DEFAULT 'contact',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, contact_id)
);

-- RLS
ALTER TABLE public.project_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view project contacts"
  ON public.project_contacts FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert project contacts"
  ON public.project_contacts FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can delete project contacts"
  ON public.project_contacts FOR DELETE
  USING (public.is_company_member(company_id));
