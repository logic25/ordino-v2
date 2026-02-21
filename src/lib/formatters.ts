/**
 * Format a phone number as (XXX) XXX-XXXX as the user types.
 * Strips non-digits, then applies formatting.
 */
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Format a Tax ID / EIN as XX-XXXXXXX as the user types.
 * Strips non-digits, then applies formatting.
 */
export function formatTaxId(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

/**
 * Create an onChange handler that formats the value before calling the setter.
 */
export function handleFormattedChange(
  formatter: (value: string) => string,
  setter: (value: string) => void
) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(formatter(e.target.value));
  };
}
