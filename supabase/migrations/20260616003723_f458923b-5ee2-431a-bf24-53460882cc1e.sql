INSERT INTO public.changelog_entries (company_id, date, title, description, tag)
SELECT id, CURRENT_DATE, 'Discuss emails in Google Chat', 'Open an email and click "Discuss in Chat" to start a Google Chat about it. The chat side panel opens with the subject, sender, and a short preview pre-filled, and you can pick which space or DM to post to before sending.', 'feature'
FROM public.companies;