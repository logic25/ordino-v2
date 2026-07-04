ALTER TABLE public.bd_event_sources
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'WEBSITE',
  ADD COLUMN IF NOT EXISTS last_scrape_error text,
  ADD COLUMN IF NOT EXISTS last_scrape_events_found integer;