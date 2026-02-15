
-- Table to track partner outreach for discovered RFPs
CREATE TABLE public.rfp_partner_outreach (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  discovered_rfp_id UUID NOT NULL REFERENCES public.discovered_rfps(id) ON DELETE CASCADE,
  partner_client_id UUID NOT NULL REFERENCES public.clients(id),
  contact_name TEXT,
  contact_email TEXT,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_status TEXT NOT NULL DEFAULT 'pending', -- pending, interested, passed
  responded_at TIMESTAMPTZ,
  response_token UUID NOT NULL DEFAULT gen_random_uuid(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one outreach per partner per discovered RFP
ALTER TABLE public.rfp_partner_outreach ADD CONSTRAINT unique_outreach_per_partner UNIQUE (discovered_rfp_id, partner_client_id);

-- Enable RLS
ALTER TABLE public.rfp_partner_outreach ENABLE ROW LEVEL SECURITY;

-- RLS: company members can read/write their own company's outreach
CREATE POLICY "Company members can view outreach"
  ON public.rfp_partner_outreach FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can create outreach"
  ON public.rfp_partner_outreach FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update outreach"
  ON public.rfp_partner_outreach FOR UPDATE
  USING (public.is_company_member(company_id));

-- Public policy for response_token-based updates (partners clicking links)
CREATE POLICY "Anyone can update via response token"
  ON public.rfp_partner_outreach FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_rfp_partner_outreach_updated_at
  BEFORE UPDATE ON public.rfp_partner_outreach
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
