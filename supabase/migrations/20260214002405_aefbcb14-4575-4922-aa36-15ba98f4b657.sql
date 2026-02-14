
-- Create scheduled_emails table
CREATE TABLE public.scheduled_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  email_draft JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_send_time TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  status TEXT NOT NULL DEFAULT 'scheduled',
  project_id UUID REFERENCES public.projects(id),
  gmail_message_id TEXT,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Company members can view scheduled emails
CREATE POLICY "Company isolation for scheduled_emails"
  ON public.scheduled_emails FOR SELECT
  USING (is_company_member(company_id));

-- Company members can create scheduled emails
CREATE POLICY "Company members can create scheduled_emails"
  ON public.scheduled_emails FOR INSERT
  WITH CHECK (is_company_member(company_id));

-- Users can update their own scheduled emails or admin/manager
CREATE POLICY "Users can update own scheduled_emails"
  ON public.scheduled_emails FOR UPDATE
  USING (
    user_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1)
    OR is_admin_or_manager(company_id)
  );

-- Users can delete their own scheduled emails or admin/manager
CREATE POLICY "Users can delete own scheduled_emails"
  ON public.scheduled_emails FOR DELETE
  USING (
    user_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1)
    OR is_admin_or_manager(company_id)
  );

-- Indexes
CREATE INDEX idx_scheduled_emails_status_time ON public.scheduled_emails(status, scheduled_send_time);
CREATE INDEX idx_scheduled_emails_company ON public.scheduled_emails(company_id);
