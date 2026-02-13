
-- Add new columns to emails table for Phase 1 + Phase 2 prep
ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS assigned_to UUID NULL,
  ADD COLUMN IF NOT EXISTS assigned_by UUID NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_emails_tags ON public.emails USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_emails_snoozed ON public.emails(snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_archived ON public.emails(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_assigned ON public.emails(assigned_to) WHERE assigned_to IS NOT NULL;

-- Email notes table for Phase 2
CREATE TABLE IF NOT EXISTS public.email_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_notes_email_id ON public.email_notes(email_id);

-- RLS for email_notes
ALTER TABLE public.email_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company isolation for email_notes"
  ON public.email_notes FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can create email_notes"
  ON public.email_notes FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "Users can delete own notes or admin"
  ON public.email_notes FOR DELETE
  USING (
    (user_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1))
    OR is_admin_or_manager(company_id)
  );
