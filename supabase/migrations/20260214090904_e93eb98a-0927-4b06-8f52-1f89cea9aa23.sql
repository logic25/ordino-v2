
-- Documents attached to billing rules
CREATE TABLE public.billing_rule_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  billing_rule_id UUID NOT NULL REFERENCES public.client_billing_rules(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES public.profiles(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revised_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_rule_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view billing rule documents"
  ON public.billing_rule_documents FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert billing rule documents"
  ON public.billing_rule_documents FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update billing rule documents"
  ON public.billing_rule_documents FOR UPDATE
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can delete billing rule documents"
  ON public.billing_rule_documents FOR DELETE
  USING (public.is_company_member(company_id));

-- Storage bucket for billing rule docs
INSERT INTO storage.buckets (id, name, public) VALUES ('billing-rule-docs', 'billing-rule-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Company members can upload billing rule docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'billing-rule-docs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Company members can read billing rule docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'billing-rule-docs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Company members can delete billing rule docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'billing-rule-docs' AND auth.uid() IS NOT NULL);
