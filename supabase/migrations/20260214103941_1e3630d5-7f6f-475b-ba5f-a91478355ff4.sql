
-- Universal Documents: company-wide file storage
CREATE TABLE public.universal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES public.profiles(id),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.universal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view universal documents"
  ON public.universal_documents FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert universal documents"
  ON public.universal_documents FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update universal documents"
  ON public.universal_documents FOR UPDATE
  USING (public.is_company_member(company_id));

CREATE POLICY "Admins can delete universal documents"
  ON public.universal_documents FOR DELETE
  USING (public.is_company_admin(company_id));

CREATE TRIGGER update_universal_documents_updated_at
  BEFORE UPDATE ON public.universal_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lead Sources: configurable list of how clients found you
CREATE TABLE public.lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view lead sources"
  ON public.lead_sources FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Admins can manage lead sources"
  ON public.lead_sources FOR INSERT
  WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY "Admins can update lead sources"
  ON public.lead_sources FOR UPDATE
  USING (public.is_company_admin(company_id));

CREATE POLICY "Admins can delete lead sources"
  ON public.lead_sources FOR DELETE
  USING (public.is_company_admin(company_id));

CREATE TRIGGER update_lead_sources_updated_at
  BEFORE UPDATE ON public.lead_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for universal documents
INSERT INTO storage.buckets (id, name, public) VALUES ('universal-documents', 'universal-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Company members can read universal docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'universal-documents');

CREATE POLICY "Company members can upload universal docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'universal-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Company members can delete universal docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'universal-documents' AND auth.uid() IS NOT NULL);
