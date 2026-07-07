
ALTER TABLE public.portal_notifications
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS portal_notifications_email_pending_idx
  ON public.portal_notifications (created_at DESC)
  WHERE email_sent_at IS NULL;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
