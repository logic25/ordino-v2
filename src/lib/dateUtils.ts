import { format, isValid } from "date-fns";

/**
 * Safely format a date string. Returns fallback if the value is
 * null, undefined, empty, or not a valid date — preventing
 * `RangeError: Invalid time value` crashes.
 */
export function safeFormatDate(
  dateStr: string | null | undefined,
  fmt: string,
  fallback = "—"
): string {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  return isValid(d) ? format(d, fmt) : fallback;
}
