CREATE UNIQUE INDEX IF NOT EXISTS bd_activities_email_dedupe_idx
ON public.bd_activities (lead_id, ((metadata->>'email_id')))
WHERE type = 'EMAIL' AND metadata ? 'email_id';