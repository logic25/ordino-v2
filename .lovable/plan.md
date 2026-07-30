## Goal
Let users rename a document's `title` (never `filename` / `storage_path`) from both the preview sheet and the document row actions.

## What I verified first
- `universal_documents.title` exists; `useUniversalDocuments.ts` has upload/delete/move mutations but no title update.
- `DocumentPreviewSheet.tsx` already receives `isBeaconFolder` and `isAdmin` props and gates content editing with `isEditable && (!isBeaconFolder || isAdmin)`.
- **Correction to step 3:** `KnowledgeBaseView.tsx` does **not** list `universal_documents` rows — it lists filenames returned by the external Beacon (Railway) knowledge API, with no document id or title. A "Rename" there would have nothing to write to. The row-level context menu for real documents lives in `src/pages/Documents.tsx` (~line 561, alongside "Move" and "Delete"), which already has the `UniversalDocument` object, `isBeaconFolder`, and `isAdmin`. I'll add Rename there instead.

## Plan

**1. `src/hooks/useUniversalDocuments.ts`**
Add `useUpdateDocumentTitle()`: `{ id, title }` → `update({ title: title.trim() })` on `universal_documents`, invalidating `["universal-documents"]` on success. Rejects empty titles.

**2. `src/components/documents/DocumentPreviewSheet.tsx`**
- Local `renaming` / `titleDraft` state.
- Pencil "Rename" button next to `<SheetTitle>`; when active the heading becomes an `Input` with Save / Cancel (Enter saves, Esc cancels).
- Save calls the mutation, toasts "Title updated", exits rename mode.
- Gate: `(!isBeaconFolder || isAdmin)` — same Beacon-admin rule as content editing, but **without** the `isEditable` (text/markdown-only) part, so PDFs and images can still be renamed. Titles are metadata, not file content; if you'd rather keep the exact `isEditable && …` gate, say so and I'll match it literally.

**3. `src/pages/Documents.tsx`**
- Add a "Rename…" item to the existing document row dropdown, gated the same way.
- It opens a small rename dialog (same mutation + toast). A dialog rather than in-row inline editing keeps the table layout stable and reuses the existing Move/Delete dialog pattern on that page.

**4. Changelog**
Insert a `changelog_entries` row for the rename capability.

## Out of scope
No schema change, no `filename` / `storage_path` change, no Beacon re-ingest (Pinecone chunks are keyed off filename and stay untouched).
