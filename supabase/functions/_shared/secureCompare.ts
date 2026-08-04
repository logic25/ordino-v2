/**
 * Constant-time comparison for secrets — cron keys, webhook secrets, shared
 * API keys. Plain `a === b` short-circuits at the first differing byte, which
 * leaks (via response time) how much of a guessed secret is correct. This
 * compares in time independent of WHERE the first mismatch is.
 *
 * Returns false for any missing/empty input and for length mismatches (an
 * attacker learning only a secret's length gains little). Equal-length inputs
 * are compared byte-by-byte with no early exit.
 *
 * Secrets here are ASCII (base64/hex/uuid), so charCodeAt per position is exact.
 */
export function secureEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
