# KB preview: fix run-on / over-bolded document rendering

## Why it looks like this

The preview for `ca-elecover.pdf` renders text that Beacon extracted from the PDF at ingest time and reassembled from Pinecone chunks. Two separate causes:

1. **The stored text is already damaged.** Words are split mid-token (`w hat you shoul d know`) and whole paragraphs arrive as a single line with no breaks. That comes from PDF text extraction upstream — Ordino only displays it.
2. **The preview's normalizer over-promotes headings.** In `BeaconDocumentModal.tsx`, `normalizeMarkdown` turns any `#`-`######` marker into a heading wherever it appears (`/\s*(#{1,6})\s+/`). When the source is one long line, three sentences get swallowed into one `##` heading — which is exactly the giant bold block at the top of the screenshot. There is also no rule that re-breaks run-on prose into paragraphs.

## Plan — preview-side rendering fixes

All changes in `src/components/documents/BeaconDocumentModal.tsx` (`normalizeMarkdown`), display-only, no re-ingest, no change to stored content:

- **Cap heading length.** A `#`-marked segment becomes a real heading only when it is short (roughly under 90 characters) and has no sentence-ending punctuation mid-way. Longer segments render as a bold lead-in followed by normal paragraph text, so a full paragraph can never render as an H2.
- **Terminate headings at the sentence boundary.** When a heading line runs on, cut it at the first `. ` / `: ` followed by a capital and push the remainder into a paragraph.
- **Re-break run-on prose.** Split single-line blobs into paragraphs at sentence boundaries when a line exceeds a length threshold, so body copy stops rendering as one wall of text.
- **Repair split words conservatively.** Rejoin only clearly broken tokens — a single-letter fragment adjacent to a word fragment (`w hat` → `what`, `shoul d` → `should`) — using a strict pattern that leaves legitimate single-letter words (`a`, `I`) alone. Anything ambiguous is left exactly as stored.
- **Raw view escape hatch.** Add a "Raw text" toggle next to the existing Edit/Properties/History controls so you can always see the unformatted stored content and judge whether the source itself needs a re-ingest.

## Note on the real fix

Cosmetic cleanup makes the preview readable, but the damaged text is also what Beacon retrieves from and cites. Documents like this one ideally get re-ingested with a better PDF text extractor on the Railway side. The Raw text toggle makes it easy to spot which documents need that.

## Technical notes

- Single file touched: `src/components/documents/BeaconDocumentModal.tsx`.
- `normalizeMarkdown` becomes a small pipeline of named steps so each heuristic is testable in isolation.
- Add unit tests under `src/components/documents/__tests__/` covering: long `##` line does not become a heading, short one does, run-on paragraph splits, `w hat` rejoins, `a permit` / `I filed` untouched.
- Changelog entry inserted per project convention.
