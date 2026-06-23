CREATE INDEX IF NOT EXISTS idx_emails_user_unread_inbox_active
ON public.emails (user_id)
WHERE is_read = false
  AND archived_at IS NULL
  AND labels @> '["INBOX"]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_emails_user_gmail_message
ON public.emails (user_id, gmail_message_id);

INSERT INTO public.changelog_entries (company_id, title, description, tag)
SELECT id,
       'Gmail unread count reliability',
       'Inbox unread count now matches Gmail exactly — sync reconciles against Gmail''s authoritative unread inbox set every run, and the sidebar/Inbox tab share the same server-side count.',
       'fix'
FROM public.companies
ORDER BY created_at ASC
LIMIT 1;