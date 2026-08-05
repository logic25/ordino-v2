ALTER TABLE public.bd_market_signals
  ADD COLUMN IF NOT EXISTS enrichment jsonb,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz;