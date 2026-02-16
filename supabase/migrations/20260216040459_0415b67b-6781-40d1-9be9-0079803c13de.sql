
-- Create lead_statuses lookup table
CREATE TABLE public.lead_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT 'default',
  sort_order INT NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company lead statuses"
  ON public.lead_statuses FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert lead statuses"
  ON public.lead_statuses FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update lead statuses"
  ON public.lead_statuses FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete non-system lead statuses"
  ON public.lead_statuses FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND is_system = false);

-- Unique constraint
CREATE UNIQUE INDEX idx_lead_statuses_company_value ON public.lead_statuses(company_id, value);
