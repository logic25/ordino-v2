# Fix stray text fragments in Knowledge Base document preview

## What you're seeing

Lines like `ral Filing and Permit Requirements` and `ing BB 2025-011 online, ensure you have Rev1 (Oct 28, 2025) version ---` are chunk-boundary leftovers.

When a document is ingested, Beacon splits it into overlapping chunks. The preview reassembles those chunks by concatenating them, so the overlapping tail/head of adjacent chunks reappears as an orphan fragment — often starting mid-word (`...Structu` + `ral Filing and Permit Requirements`). The source document is fine; the reassembly is what's wrong.

Note: this is a reading of the symptom pattern, not yet confirmed against the raw chunk payload. Step 1 confirms it before any fix ships.

## Plan

1. **Confirm the cause.** Fetch the raw `file-content` payload for BB 2025-011 and inspect whether the returned text contains duplicated/overlapping chunk boundaries (vs. the fragments being present in the stored source itself).

2. **Prefer the original file when we have it.** We already keep source files in `kb-originals` (`beacon_kb_originals`). If an original exists for the document, render the preview from that instead of the reassembled chunk text — no boundary artifacts at all.

3. **Clean up reassembled text as fallback** (for documents ingested before originals were kept): in the preview render path, de-duplicate overlapping chunk seams — drop a leading fragment when it repeats the tail of the preceding block, and drop orphan lines that begin mid-word and duplicate text already shown.

4. **Do not touch what's in the knowledge base.** This is display-only; nothing is re-ingested and no chunks change, so Beacon's answers are unaffected.

5. **Changelog entry** for the fix.

## Technical notes

- Preview data comes from `fetchBeaconFileContent` in `src/services/beaconApi.ts`, rendered in `src/components/documents/BeaconDocumentModal.tsx`.
- Original-file lookup and signed URL already exist in `src/hooks/useKbOriginal.ts`.
- Seam cleanup belongs in a small pure helper (easy to unit-test) rather than inline in the modal.
