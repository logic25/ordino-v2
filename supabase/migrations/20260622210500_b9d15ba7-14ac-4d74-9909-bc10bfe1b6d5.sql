ALTER TABLE public.gmail_connections
  ADD COLUMN IF NOT EXISTS signature_html text,
  ADD COLUMN IF NOT EXISTS signature_synced_at timestamptz;