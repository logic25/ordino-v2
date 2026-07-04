CREATE INDEX IF NOT EXISTS idx_emails_unread_inbox
ON public.emails (company_id, archived_at)
WHERE is_read = false;