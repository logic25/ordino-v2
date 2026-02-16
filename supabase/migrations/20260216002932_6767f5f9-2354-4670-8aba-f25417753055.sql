
CREATE TABLE public.lead_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  content TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view lead notes"
  ON public.lead_notes FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert lead notes"
  ON public.lead_notes FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can delete lead notes"
  ON public.lead_notes FOR DELETE
  USING (public.is_company_member(company_id));

CREATE INDEX idx_lead_notes_lead_id ON public.lead_notes(lead_id);
