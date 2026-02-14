
-- Create email_reminders table
CREATE TABLE public.email_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  remind_at TIMESTAMPTZ NOT NULL,
  condition TEXT NOT NULL DEFAULT 'no_reply',
  status TEXT NOT NULL DEFAULT 'pending',
  reminded_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view reminders in their company"
  ON public.email_reminders FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Users can create reminders in their company"
  ON public.email_reminders FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Users can update their own reminders"
  ON public.email_reminders FOR UPDATE
  USING (user_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can delete their own reminders"
  ON public.email_reminders FOR DELETE
  USING (user_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- Index for background worker queries
CREATE INDEX idx_email_reminders_pending ON public.email_reminders (remind_at) WHERE status = 'pending';
CREATE INDEX idx_email_reminders_email ON public.email_reminders (email_id);
