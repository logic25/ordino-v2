
-- Manual project sheets for RFP Notable Projects tab
CREATE TABLE public.rfp_project_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  location TEXT,
  completion_date DATE,
  estimated_value NUMERIC,
  tags TEXT[] DEFAULT '{}',
  reference_contact_name TEXT,
  reference_contact_title TEXT,
  reference_contact_email TEXT,
  reference_contact_phone TEXT,
  reference_notes TEXT,
  photos TEXT[] DEFAULT '{}',
  documents TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rfp_project_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view project sheets"
  ON public.rfp_project_sheets FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert project sheets"
  ON public.rfp_project_sheets FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update project sheets"
  ON public.rfp_project_sheets FOR UPDATE
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can delete project sheets"
  ON public.rfp_project_sheets FOR DELETE
  TO authenticated
  USING (public.is_company_member(company_id));

-- Storage bucket for project sheet photos
INSERT INTO storage.buckets (id, name, public) VALUES ('rfp-project-photos', 'rfp-project-photos', true);

CREATE POLICY "Company members can upload project photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'rfp-project-photos');

CREATE POLICY "Anyone can view project photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'rfp-project-photos');

CREATE POLICY "Company members can delete project photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'rfp-project-photos');
