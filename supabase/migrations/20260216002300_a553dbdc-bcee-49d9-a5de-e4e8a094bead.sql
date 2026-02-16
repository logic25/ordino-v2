
-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  full_name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  property_address TEXT,
  subject TEXT,
  client_type TEXT,
  source TEXT NOT NULL DEFAULT 'phone_call',
  notes TEXT,
  assigned_to UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'new',
  proposal_id UUID REFERENCES public.proposals(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Policies: company members can CRUD
CREATE POLICY "Company members can view leads"
  ON public.leads FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can create leads"
  ON public.leads FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update leads"
  ON public.leads FOR UPDATE
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can delete leads"
  ON public.leads FOR DELETE
  USING (public.is_company_member(company_id));

-- Updated_at trigger
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for common queries
CREATE INDEX idx_leads_company_status ON public.leads(company_id, status);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
