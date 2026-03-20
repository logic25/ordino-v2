ALTER TABLE public.filing_runs
  ADD COLUMN IF NOT EXISTS session_url TEXT,
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS screenshots JSONB DEFAULT '[]'::jsonb;