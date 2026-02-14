
-- Create email_drafts table
CREATE TABLE public.email_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  to_recipients TEXT[] DEFAULT '{}',
  cc_recipients TEXT[] DEFAULT '{}',
  bcc_recipients TEXT[] DEFAULT '{}',
  subject TEXT DEFAULT '',
  body_html TEXT DEFAULT '',
  reply_to_email_id UUID REFERENCES public.emails(id) ON DELETE SET NULL,
  forward_from_email_id UUID REFERENCES public.emails(id) ON DELETE SET NULL,
  draft_type TEXT NOT NULL DEFAULT 'compose',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own drafts"
  ON public.email_drafts FOR SELECT
  USING (user_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can create drafts in their company"
  ON public.email_drafts FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Users can update their own drafts"
  ON public.email_drafts FOR UPDATE
  USING (user_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can delete their own drafts"
  ON public.email_drafts FOR DELETE
  USING (user_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE INDEX idx_email_drafts_user ON public.email_drafts (user_id, updated_at DESC);
