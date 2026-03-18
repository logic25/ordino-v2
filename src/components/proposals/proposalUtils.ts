/**
 * Shared utilities for proposal rendering (preview + public page)
 */

/** Parse terms text into labeled sub-sections.
 *  Detects headings that end with ":" on their own line (or lines that are all uppercase).
 *  Falls back to a single "General" section if no headings are found.
 */
export interface TermsSection {
  heading: string;
  body: string;
}

export function parseTermsSections(text: string): TermsSection[] {
  if (!text?.trim()) return [];

  const lines = text.split("\n");
  const sections: TermsSection[] = [];
  let currentHeading = "";
  let currentBody: string[] = [];

  const isHeading = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    // Line ends with colon and is short (< 60 chars), treat as heading
    if (trimmed.endsWith(":") && trimmed.length < 60) return true;
    // All uppercase line (> 3 chars) is a heading
    if (trimmed.length > 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) return true;
    return false;
  };

  for (const line of lines) {
    if (isHeading(line)) {
      // Save previous section
      if (currentHeading || currentBody.length > 0) {
        sections.push({
          heading: currentHeading,
          body: currentBody.join("\n").trim(),
        });
      }
      currentHeading = line.trim().replace(/:$/, "");
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  // Save last section
  if (currentHeading || currentBody.length > 0) {
    sections.push({
      heading: currentHeading,
      body: currentBody.join("\n").trim(),
    });
  }

  return sections;
}
