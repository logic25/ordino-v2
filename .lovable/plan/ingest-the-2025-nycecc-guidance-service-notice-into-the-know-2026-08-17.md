# Ingest the 2025 NYCECC Guidance Service Notice into the Knowledge Base

Add the missing base document `nycecc_guidance-sn.pdf` (nyc.gov/assets/buildings/pdf/nycecc_guidance-sn.pdf) to Beacon's knowledge base, filed alongside its existing March 2026 Follow-Up 1.

## Where it goes

- Folder: `service_notices` (source type `service_notice`) — same folder as the follow-up notice already in the KB.
- Title: `DOB Service Notice - 2025 NYCECC Guidance (Base Notice)` so it sorts next to the follow-up and is unambiguous.
- Jurisdiction: `NYC`.
- Uploaded by: recorded as the ingest actor.

## Steps

1. Fetch the PDF from the DOB URL and confirm it is a real PDF (content type, non-trivial byte size). If the URL 404s or returns HTML, stop and report — no placeholder ingest.
2. Send it through the existing ingest path (`beacon-proxy?action=ingest`) with the folder, jurisdiction, and title above. The same call retains the source file in the `kb-originals` bucket and writes the `beacon_kb_originals` row, so "Download original" works.
3. Verify after ingest: re-read the knowledge list and confirm the new entry appears under `service_notices` with a chunk count greater than 1. A 0- or 1-chunk result means extraction failed — in that case report it rather than leaving a phantom entry.
4. Log a `changelog_entries` row for the KB addition.

## Notes

No schema changes, no new code — this uses the existing ingest edge function and storage bucket. If the PDF is image-only and extracts poorly, I'll flag it instead of silently accepting a bad chunking.
