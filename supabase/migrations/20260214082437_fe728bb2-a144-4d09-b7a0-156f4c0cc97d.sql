
-- ACH Authorizations table
CREATE TABLE public.ach_authorizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  payment_plan_id UUID NOT NULL,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  client_id UUID REFERENCES public.clients(id),
  client_name TEXT NOT NULL,
  bank_name TEXT,
  routing_number_last4 TEXT,
  account_number_last4 TEXT,
  account_type TEXT NOT NULL DEFAULT 'checking',
  authorization_text TEXT NOT NULL,
  signature_data TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ach_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ACH authorizations for their company"
  ON public.ach_authorizations FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create ACH authorizations for their company"
  ON public.ach_authorizations FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update ACH authorizations for their company"
  ON public.ach_authorizations FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- ClaimFlow Referrals table
CREATE TABLE public.claimflow_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  client_id UUID REFERENCES public.clients(id),
  case_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.claimflow_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view claimflow referrals for their company"
  ON public.claimflow_referrals FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create claimflow referrals for their company"
  ON public.claimflow_referrals FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update claimflow referrals for their company"
  ON public.claimflow_referrals FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
