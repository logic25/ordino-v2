
-- Signal Subscriptions
CREATE TABLE public.signal_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'prospect',
  subscribed_at timestamptz,
  expires_at timestamptz,
  owner_email text,
  owner_phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id, company_id)
);

ALTER TABLE public.signal_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signal_subscriptions_select" ON public.signal_subscriptions FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "signal_subscriptions_insert" ON public.signal_subscriptions FOR INSERT WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "signal_subscriptions_update" ON public.signal_subscriptions FOR UPDATE USING (public.is_company_member(company_id));
CREATE POLICY "signal_subscriptions_delete" ON public.signal_subscriptions FOR DELETE USING (public.is_company_member(company_id));

CREATE INDEX idx_signal_subscriptions_property ON public.signal_subscriptions(property_id);
CREATE INDEX idx_signal_subscriptions_company ON public.signal_subscriptions(company_id);

-- Signal Violations
CREATE TABLE public.signal_violations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agency text NOT NULL,
  violation_number text NOT NULL,
  violation_type text,
  description text NOT NULL,
  issued_date date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  penalty_amount numeric,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signal_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signal_violations_select" ON public.signal_violations FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "signal_violations_insert" ON public.signal_violations FOR INSERT WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "signal_violations_update" ON public.signal_violations FOR UPDATE USING (public.is_company_member(company_id));
CREATE POLICY "signal_violations_delete" ON public.signal_violations FOR DELETE USING (public.is_company_member(company_id));

CREATE INDEX idx_signal_violations_property ON public.signal_violations(property_id);
CREATE INDEX idx_signal_violations_company ON public.signal_violations(company_id);

-- Signal Applications
CREATE TABLE public.signal_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_number text NOT NULL,
  application_type text NOT NULL,
  filing_status text,
  applicant_name text,
  filed_date date,
  description text,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signal_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signal_applications_select" ON public.signal_applications FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "signal_applications_insert" ON public.signal_applications FOR INSERT WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "signal_applications_update" ON public.signal_applications FOR UPDATE USING (public.is_company_member(company_id));
CREATE POLICY "signal_applications_delete" ON public.signal_applications FOR DELETE USING (public.is_company_member(company_id));

CREATE INDEX idx_signal_applications_property ON public.signal_applications(property_id);
CREATE INDEX idx_signal_applications_company ON public.signal_applications(company_id);

-- Updated_at trigger for signal_subscriptions
CREATE TRIGGER update_signal_subscriptions_updated_at
  BEFORE UPDATE ON public.signal_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
