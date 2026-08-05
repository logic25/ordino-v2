# Surface Uploaded By / Modified in the Beacon Knowledge Base grid

## What I verified first

I called the live knowledge-list endpoint. Beacon does return per-document metadata, but the current values matter for expectations:

- Every item includes `filename`, `folder`, `source_type`, `chunks_created`, `ingested_at`, `uploaded_by`, `is_current`, `version`.
- `uploaded_by` is currently an **empty string on the documents I sampled** — Beacon has the field, but nothing has been writing it.
- `ingested_at` is the literal string `"pre-manifest"` for older documents and a real ISO timestamp for recently ingested ones (e.g. `1_RCNY_101-14.pdf` → `2026-08-05T17:17:21`).

So: wiring the metadata through will light up **Modified** for recently ingested files, and **Uploaded By** will start filling in only for uploads made after change 3 ships. Historical rows will honestly keep showing "—" (Beacon has no uploader recorded for them). The grid already falls back to our local override/document records for uploader, so rows we stamped locally keep working.

## Changes

**1. Carry metadata through the service layer** (`src/services/beaconApi.ts`)
- Extend `BeaconKnowledgeDetail` with `uploaded_by?: string` and `ingested_at?: string` (`chunks_created` is already there).
- In `fetchBeaconKnowledgeList()`, alongside the existing folder-building logic (unchanged), build `docMeta: Record<string, { uploaded_by?: string; chunks_created?: number; ingested_at?: string }>` keyed by filename, and add `docMeta` to `BeaconKnowledgeData`.

**2. Render it in the grid** (`src/components/documents/KnowledgeBaseView.tsx`)
- Extend the existing `fileMeta(filename)` helper so it falls back to `docMeta[filename]`:
  - Uploader: local document/override uploader first, then `docMeta.uploaded_by` (ignore empty string), else `—`.
  - Modified: local `updated_at`/`created_at` first, then `docMeta.ingested_at` — treated as missing when empty or `"pre-manifest"`.
- Chunk count: fall back to `docMeta[filename]?.chunks_created` when `fileChunks` has no entry.
- Because sorting already routes through `fileMeta()` and `chunkCount()`, the Uploaded By / Modified / Chunks column sorts pick up the new values with no extra work.

**3. Record the uploader on future uploads**
- `syncDocumentToBeacon()` gains an optional `uploadedBy` argument appended to the multipart form as `uploaded_by` (the ingest proxy forwards the form data through untouched, so no edge-function change is needed).
- Pass the current user's display name (`profile.display_name`, else `first_name last_name`) from the Knowledge Base upload flow (`useUploadToBeaconKB` / `handleUpload`) and from `BeaconDocumentModal`'s save/re-ingest path.

**4. Changelog** entry for the improvement.

## Note on caching

The KB list is cached for ~5 minutes by React Query, so after this ships a hard refresh (Cmd+Shift+R) shows the new values immediately.
