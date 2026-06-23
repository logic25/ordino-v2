/**
 * Decode common HTML entities found in Gmail snippet text
 * (Gmail returns snippets with numeric and named entities, e.g. &#39; &amp; &quot;).
 */
const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeHtmlEntities(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(parseInt(n, 10));
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => {
      try {
        return String.fromCodePoint(parseInt(n, 16));
      } catch {
        return _;
      }
    })
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED[name.toLowerCase()] ?? m);
}
