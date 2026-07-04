-- Persistent rate limiting table for edge functions.
-- Atomic INSERT ... ON CONFLICT upserts so limits survive across cold starts
-- and cannot be bypassed by hitting different function instances.
CREATE TABLE public.rate_limits (
  bucket_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_key, window_start)
);

-- Only the service_role (used by edge functions) touches this table.
-- No anon / authenticated grants — end-users never read or write it directly.
GRANT ALL ON public.rate_limits TO service_role;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Deny-by-default: no policies for anon/authenticated. service_role bypasses RLS.
CREATE POLICY "rate_limits_service_role_only"
  ON public.rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_rate_limits_window_start ON public.rate_limits (window_start);

-- Atomic hit-and-check RPC. Uses a fixed-size time window (default 60s) so
-- the (bucket_key, window_start) PK guarantees ON CONFLICT is atomic.
-- Returns TRUE when the caller is OVER the limit and should be rejected.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  _bucket_key TEXT,
  _limit INTEGER,
  _window_seconds INTEGER DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start TIMESTAMPTZ;
  _new_count INTEGER;
BEGIN
  -- Floor now() to the start of the current window bucket.
  _window_start := to_timestamp(
    floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds
  );

  INSERT INTO public.rate_limits (bucket_key, window_start, count, updated_at)
  VALUES (_bucket_key, _window_start, 1, now())
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1, updated_at = now()
  RETURNING count INTO _new_count;

  -- Opportunistic cleanup of stale rows (older than 1 hour).
  DELETE FROM public.rate_limits
  WHERE window_start < now() - INTERVAL '1 hour';

  RETURN _new_count > _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER) TO service_role;

-- Verify final policy state (per docs/security-migrations.md).
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'rate_limits'
ORDER BY cmd, policyname;