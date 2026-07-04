// Constant-time string comparison for secret / token / signature checks.
// Prevents timing-oracle attacks where naive `===` short-circuits and leaks
// per-character comparison time.
//
// Use for:
//   - x-cron-secret / x-webhook-secret header checks
//   - HMAC hex digest comparisons
//   - any other pre-shared token where the caller controls the input
//
// Do NOT use for user-facing equality (usernames, IDs) — reserve for secrets.

export function timingSafeEqual(a: string, b: string): boolean {
  // Length difference is not itself a secret; length-mismatch fast-exit is fine
  // and matches the behavior of Node's crypto.timingSafeEqual on differing sizes.
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Convenience wrapper for the cron-secret pattern: accept if the caller matches
// EITHER of two allowed values (typically env CRON_SECRET or vault cron_secret).
// Both comparisons run to keep timing uniform.
export function timingSafeEqualAny(provided: string, allowed: (string | null | undefined)[]): boolean {
  let ok = false;
  for (const candidate of allowed) {
    if (candidate && provided.length === candidate.length && timingSafeEqual(provided, candidate)) {
      ok = true;
    }
  }
  return ok;
}

// Persistent per-key rate limiter backed by public.rate_limits + public.rate_limit_hit.
// Replaces the in-memory Map pattern which is bypassable across cold starts.
// Returns true if the caller is over the limit and should be rejected.
export async function isRateLimited(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  bucketKey: string,
  limit: number,
  windowSeconds = 60,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("rate_limit_hit", {
    _bucket_key: bucketKey,
    _limit: limit,
    _window_seconds: windowSeconds,
  });
  if (error) {
    // Fail-open on DB error rather than lock out all callers; log for visibility.
    console.error("rate_limit_hit RPC failed:", error);
    return false;
  }
  return data === true;
}
