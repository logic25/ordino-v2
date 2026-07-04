ALTER TABLE public.beacon_interactions ADD COLUMN IF NOT EXISTS addressed_at timestamptz;
CREATE INDEX IF NOT EXISTS beacon_interactions_addressed_at_idx ON public.beacon_interactions (addressed_at);