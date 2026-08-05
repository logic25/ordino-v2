# Fix Knowledge Base document preview formatting

## What's actually happening

The preview you're looking at is not the document. It is a reconstruction stitched together from the search index:

- `BeaconDocumentModal` loads content from Beacon's `file-content` endpoint, which glues the indexed chunks of the file back together. Chunks overlap at their edges and drop the original line breaks, so you get repeated half-sentences, run-on paragraphs, and text that stops mid-word ("w hat you shoul d know", "w hat el se").
- To compensate, the modal runs `normalizeMarkdown()` — a set of regex guesses that re-inserts headings, bullets, and table rows. When the guesses miss, ordinary sentences get promoted to big bold headings (the "An AHV permit is required…" block in your screenshot) and real headings stay inline. That's the inconsistency.
- The real fix — keeping the uploaded source file — exists but is new: only 3 of 184 knowledge-base documents currently have an original stored, so nearly every preview falls back to the lossy reconstruction.

## Plan

### 1. Show the original file whenever we have it
When a stored original exists, render that instead of the reconstruction: PDFs in an inline viewer, text/markdown as their true source. Reconstruction becomes fallback only.

### 2. Make the fallback honest instead of guessing
- Drop the aggressive heading/list/table regexes that invent structure. Keep only safe, unambiguous fixes (line-break normalization, de-duplicating overlapping chunk seams, repairing split words like "w hat" → "what").
- Render the fallback as clean plain text with preserved paragraph breaks, not styled markdown, so nothing gets randomly bolded.
- Add a small banner: "Reconstructed from the search index — formatting may differ from the source file", plus a note at the end when the text ends mid-chunk so an abrupt stop is explained rather than looking like a bug.

### 3. Close the gap for the other 181 documents
Add a "Attach original file" action on documents that have no stored original, so re-uploading the source upgrades the preview permanently without re-ingesting a duplicate into the index. Flag documents lacking an original with a subtle marker in the Knowledge Base grid.

## Technical notes

- `src/components/documents/BeaconDocumentModal.tsx`: branch on `useKbOriginal(sourceFile)`; PDF originals via signed URL in an iframe, text originals rendered directly; `normalizeMarkdown` trimmed to seam de-duplication + whitespace repair and moved to plain-text rendering.
- No backend or schema change required for steps 1-2; step 3 reuses the existing `kb-originals` bucket, `beacon_kb_originals` table, and `beacon-proxy` upload path.
- Changelog entry added for the preview fidelity change.
