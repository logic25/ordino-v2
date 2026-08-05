# Knowledge Base: collapse same-document variants

## What's actually happening

The three rows you're seeing are not the same file listed three times. Beacon's index holds three separate files:

```text
# FDNY Business — Filing & Applicant
# FDNY Business — Filing & Applicant.md
# FDNY Business — Filing & Applicant.txt
```

The Knowledge Base list stores each folder's files in a `Set` keyed by exact filename, so it already cannot repeat a row. The earlier UI de-duplication only removes byte-identical filenames — it has no effect here, because these names differ by extension. The duplication is real, upstream, in the ingested corpus.

## Plan (display-only, nothing deleted)

Group rows by their base name (filename with a trailing `.md` / `.txt` / `.markdown` extension stripped, trimmed, case-insensitive):

- One row per document, showing the existing display title.
- When a base name has more than one variant, show a small badge listing the formats (e.g. `MD · TXT · —`) plus a "duplicate" hint on hover naming every underlying file.
- Clicking the row previews the preferred variant (the one with a rename/override or a `universal_documents` record; otherwise `.md` > `.txt` > extensionless).
- The row menu keeps per-variant actions: Rename / Move / Delete are listed once per underlying file so you can delete just the redundant `.txt` copy from the same menu.
- Folder counts show the number of grouped documents, with the raw file count in the tooltip so the numbers stay honest.
- Search and both sort modes operate on the grouped rows.

Nothing is removed from Beacon by this change — grouping is purely how the list renders. Deleting a redundant variant stays an explicit, per-file action you take from the row menu.

## Why not auto-delete

Removing the extra copies means deleting vectors from Beacon's index. That's irreversible from Ordino and would silently change retrieval. Collapsing the view first lets you see exactly how many documents have variants, then delete them deliberately. If, after seeing the grouped list, you want a bulk "remove redundant variants" review screen, that's a follow-up batch.

## Technical notes

- File: `src/components/documents/KnowledgeBaseView.tsx` only. No schema change, no edge-function change, no Beacon API change.
- New `useMemo` builds `baseName -> variants[]` from the existing `effectiveFolders` set; the render loop iterates groups instead of raw filenames.
- Existing `fileMeta`, `overrideMap`, and `documentByFilename` lookups stay keyed by real filename — the group just picks a preferred one for display.
- Changelog entry inserted for the change, per project convention.
