-- RFI Templates: company-configurable questionnaire templates
CREATE TABLE public.rfi_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  name VARCHAR NOT NULL DEFAULT 'Project Information Sheet',
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.rfi_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company isolation for rfi_templates"
  ON public.rfi_templates FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Admins and managers can modify rfi_templates"
  ON public.rfi_templates FOR ALL
  USING (is_admin_or_manager(company_id));

CREATE TRIGGER update_rfi_templates_updated_at
  BEFORE UPDATE ON public.rfi_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RFI Requests: sent to clients, linked to a project/proposal
CREATE TABLE public.rfi_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  template_id UUID REFERENCES public.rfi_templates(id),
  project_id UUID REFERENCES public.projects(id),
  proposal_id UUID REFERENCES public.proposals(id),
  property_id UUID REFERENCES public.properties(id),
  title VARCHAR NOT NULL,
  recipient_name VARCHAR,
  recipient_email VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'draft',
  access_token UUID NOT NULL DEFAULT gen_random_uuid(),
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  responses JSONB DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.rfi_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company isolation for rfi_requests"
  ON public.rfi_requests FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Admins and managers can modify rfi_requests"
  ON public.rfi_requests FOR ALL
  USING (is_admin_or_manager(company_id));

CREATE TRIGGER update_rfi_requests_updated_at
  BEFORE UPDATE ON public.rfi_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for public access token lookup
CREATE UNIQUE INDEX idx_rfi_requests_access_token ON public.rfi_requests(access_token);