
CREATE TABLE IF NOT EXISTS public.gchat_spaces_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  cache_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  cached_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, cache_key)
);

-- RLS: only the edge function (service role) accesses this table
ALTER TABLE public.gchat_spaces_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (no user-facing RLS needed)
CREATE POLICY "Service role full access" ON public.gchat_spaces_cache
  FOR ALL USING (true) WITH CHECK (true);
