

## Fix: BeaconDocumentModal Frontmatter Parsing & Markdown Rendering

### Root Cause

The Beacon API returns content where the YAML frontmatter is **all on one single line**:

```text
--- title: After Hours Work Permit (AHV) Guide category: processes type: procedure date_issued: 2025-01-01 ... --- # After Hours Work Permit (AHV) Guide ## Overview ...
```

The current `parseFrontmatter` function searches for `\n---` (newline before closing `---`), which never matches because the closing `---` is on the **same line**, preceded by a space. As a result, the parser returns the entire raw content as the body, and ReactMarkdown receives frontmatter text mixed in.

### Fix (single file change)

**File:** `src/components/documents/BeaconDocumentModal.tsx`

Replace the `parseFrontmatter` function with one that handles both formats:

1. **Multi-line format** (standard YAML): `---\nkey: val\n---\nbody`
2. **Single-line format** (what the API returns): `--- key: val key: val --- body`

New parsing logic:
```typescript
function parseFrontmatter(content: string): { metadata: Record<string, string>; body: string } {
  if (!content) return { metadata: {}, body: "" };
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) return { metadata: {}, body: content };

  const afterOpener = trimmed.substring(3);

  // Try multi-line: \n---
  let closingIdx = afterOpener.indexOf("\n---");
  let body: string;
  let frontmatterBlock: string;

  if (closingIdx !== -1) {
    frontmatterBlock = afterOpener.substring(0, closingIdx).trim();
    body = afterOpener.substring(closingIdx + 4).trim();
  } else {
    // Single-line: " key: val key: val --- body"
    const inlineClose = afterOpener.indexOf(" ---");
    if (inlineClose === -1) return { metadata: {}, body: content };
    frontmatterBlock = afterOpener.substring(0, inlineClose).trim();
    body = afterOpener.substring(inlineClose + 4).trim();
  }

  // Parse key-value pairs from the frontmatter block
  // For single-line, keys are space-separated: "title: X category: Y"
  // Use known keys to split
  const KNOWN_KEYS = [
    "title", "category", "type", "date_issued", "jurisdiction",
    "department", "status", "tags", "supersedes", "superseded_by",
    "notice_number", "bulletin_number", "memo_number",
  ];
  const metadata: Record<string, string> = {};

  if (frontmatterBlock.includes("\n")) {
    // Multi-line: standard line-by-line parsing
    for (const line of frontmatterBlock.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        if (value && value !== "null") metadata[key] = value;
      }
    }
  } else {
    // Single-line: use known keys to split
    // Build regex like /(title|category|type|...)\s*:/g
    const keyPattern = new RegExp(
      `(?:^|\\s)(${KNOWN_KEYS.join("|")})\\s*:`, "g"
    );
    const matches = [...frontmatterBlock.matchAll(keyPattern)];
    for (let i = 0; i < matches.length; i++) {
      const key = matches[i][1];
      const valueStart = matches[i].index! + matches[i][0].length;
      const valueEnd = i + 1 < matches.length ? matches[i + 1].index! : frontmatterBlock.length;
      const value = frontmatterBlock.substring(valueStart, valueEnd).trim();
      if (value && value !== "null") metadata[key] = value;
    }
  }

  return { metadata, body };
}
```

This handles the single-line format by:
1. Detecting the closing ` --- ` (space-delimited) on the same line
2. Using known key names to split the single-line frontmatter string into key-value pairs

No other files need changes. ReactMarkdown and `@tailwindcss/typography` are already installed and configured.

