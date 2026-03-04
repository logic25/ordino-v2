

## Plan: Replace BeaconDocumentModal with user-specified implementation

### Analysis

The current `BeaconDocumentModal.tsx` stores raw API data and derives `metadata`/`body` on render. The `parseFrontmatter` function handles `\n---` and ` ---` patterns but may fail on edge cases (e.g., content starting with `---\n` specifically, or BOM/whitespace issues). The user has provided an exact replacement that uses a different approach:

1. **Explicit `---\n` detection** (checks `startsWith("---\n")` or `"---\r\n"`)
2. **Regex-based single-line parsing** using `raw.match(/^---\s+(.+?)\s+---\s*([\s\S]*)$/)`
3. **Local state** for `body` and `metadata` instead of deriving from raw data each render

### Changes

**File 1: `src/components/documents/BeaconDocumentModal.tsx`** — Complete rewrite with user's exact code:
- New `parseFrontmatter` with two explicit format branches (multi-line with `---\n`, single-line with regex)
- Component stores `body` and `metadata` in local state via `useEffect`
- Uses `useToast()` hook pattern
- Simpler title display using `metadata.title || sourceFile`

**File 2: `src/services/beaconApi.ts`** — Update `fetchBeaconFileContent` return type to match user's spec:
- Change return type to `{ source_file, content, chunks_count, source_type, folder }`

No other files need changes — `KnowledgeBaseView.tsx`, `Settings.tsx`, and `FOLDER_TO_SOURCE_TYPE` are already correct.

