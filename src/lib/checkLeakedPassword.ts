/**
 * Check if a password has appeared in known data breaches
 * using the HaveIBeenPwned k-anonymity API.
 * Only a 5-character SHA-1 prefix is sent — the full hash never leaves the browser.
 */
export async function isPasswordLeaked(password: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return false; // fail open — don't block login if API is down

    const text = await res.text();
    return text.split("\n").some((line) => line.startsWith(suffix));
  } catch {
    return false; // fail open on network errors
  }
}
