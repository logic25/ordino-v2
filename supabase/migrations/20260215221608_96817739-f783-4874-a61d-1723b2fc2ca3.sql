
-- Table to persist RFP response builder drafts
CREATE TABLE public.rfp_response_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rfp_id UUID NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_by UUID REFERENCES public.profiles(id),
  selected_sections TEXT[] NOT NULL DEFAULT '{}',
  section_order TEXT[] NOT NULL DEFAULT '{}',
  cover_letter TEXT,
  submit_email TEXT,
  wizard_step INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (rfp_id, company_id)
);

ALTER TABLE public.rfp_response_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company drafts"
  ON public.rfp_response_drafts FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Users can create drafts for their company"
  ON public.rfp_response_drafts FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Users can update their company drafts"
  ON public.rfp_response_drafts FOR UPDATE
  USING (public.is_company_member(company_id));

CREATE POLICY "Users can delete their company drafts"
  ON public.rfp_response_drafts FOR DELETE
  USING (public.is_company_member(company_id));

CREATE TRIGGER update_rfp_response_drafts_updated_at
  BEFORE UPDATE ON public.rfp_response_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
