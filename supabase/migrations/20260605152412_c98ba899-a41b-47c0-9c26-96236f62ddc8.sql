
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS bill_date_source text NOT NULL DEFAULT 'manual'
  CHECK (bill_date_source IN ('manual', 'ai'));

-- Schedule Monday Meeting Report: Mondays 04:00 UTC (Sun 11pm ET / midnight EDT)
SELECT cron.schedule(
  'monday-meeting-report',
  '0 4 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://mimlfjkisguktiqqkpkm.supabase.co/functions/v1/send-monday-meeting-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbWxmamtpc2d1a3RpcXFrcGttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwOTY0NjEsImV4cCI6MjA4NTY3MjQ2MX0.hBBQlfrPG_i1sjMOJiL6Lps1raXH3C-df6e5Uzmi9o0',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);
