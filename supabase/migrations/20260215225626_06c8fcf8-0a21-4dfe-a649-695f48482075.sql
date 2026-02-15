
-- Partner email templates table
CREATE TABLE public.partner_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_key TEXT NOT NULL DEFAULT 'custom',
  subject_template TEXT NOT NULL DEFAULT '',
  body_template TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company templates"
  ON public.partner_email_templates FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own company templates"
  ON public.partner_email_templates FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own company templates"
  ON public.partner_email_templates FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own company templates"
  ON public.partner_email_templates FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE TRIGGER update_partner_email_templates_updated_at
  BEFORE UPDATE ON public.partner_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
