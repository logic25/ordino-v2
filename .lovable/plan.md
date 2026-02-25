

# Show Beacon's Actual Knowledge Files in the KB Folder

## Overview

When the "Beacon Knowledge Base" folder is selected in the sidebar, replace the empty document table with a live view of Beacon's 87 knowledge files fetched from the Railway API. Files are grouped by their 14 folders (processes, dob_notices, zoning, etc.) in collapsible sections. An upload button lets users add new files directly to Beacon's knowledge base.

## Files to Create

### 1. `src/hooks/useBeaconKnowledge.ts`
- `useBeaconKnowledge()` -- React Query hook calling `fetchBeaconKnowledgeList()`, returns `{ folders, total_files, folder_count }` plus loading/error states
- `useUploadToBeaconKB()` -- mutation that POSTs multipart form data to `/api/ingest` with `file`, `source_type`, and `folder` fields, invalidates the knowledge list query on success

### 2. `src/components/documents/KnowledgeBaseView.tsx`
Replaces the standard document table when the KB folder is selected:
- **Stats row**: 3 compact cards -- Total Documents, Total Folders, File Types
- **Collapsible folder sections**: Accordion with humanized folder names (e.g., `building_code` becomes "Building Code") and file count badges. Each section expands to show filenames with file icons
- **Upload button**: "Upload to Knowledge Base" dialog accepting PDF/MD/TXT, with a dropdown to pick the target folder (populated from API response). POSTs to `/api/ingest`
- **Loading state**: Spinner while fetching
- **Error state**: Message if Beacon API is unreachable

## Files to Modify

### 3. `src/services/beaconApi.ts`
Add `fetchBeaconKnowledgeList()` that:
- Calls `GET /api/knowledge/list`
- Receives `{ files: ["folder/file.md", ...], count: 87 }`
- Parses folder names from path strings (split on `/`)
- Returns `{ folders: Record<string, string[]>, total_files, folder_count }`

Also add the `FOLDER_TO_SOURCE_TYPE` mapping for upload ingestion.

### 4. `src/pages/Documents.tsx`
- Import `KnowledgeBaseView`
- In the main content area (around line 295), check `isBeaconFolder`
- When true, render `<KnowledgeBaseView />` instead of the search filters + document table
- Keep breadcrumbs, sidebar, and all dialogs unchanged

## Technical Details

### API Response Shape
```text
GET /api/knowledge/list
Response: { "files": ["building_code/bc_chapter5.md", ...], "count": 87 }
```

### Path Parsing Logic
```text
"building_code/bc_chapter5.md" -> folder: "building_code", file: "bc_chapter5.md"
"standalone.md" (no slash) -> folder: "_root", file: "standalone.md"
```

### Folder-to-Source-Type Mapping (for uploads)
| Folder | source_type |
|--------|-------------|
| processes | procedure |
| dob_notices | service_notice |
| zoning | zoning |
| building_code | building_code |
| building_code_1968 | building_code |
| building_code_2022 | building_code |
| mdl | multiple_dwelling_law |
| rcny | rule |
| hmc | housing_maintenance_code |
| energy_code | building_code |
| communication | communication |
| historical | historical_determination |
| case_studies | historical_determination |
| objections | reference |

### Upload Flow
1. User clicks "Upload to Knowledge Base" in the KB view
2. Selects file + target folder from dropdown
3. POST multipart to `/api/ingest` with `file`, `source_type` (from mapping), `folder`
4. On success, invalidate knowledge list query to refresh the view

No database migrations or sidebar changes needed -- the existing "Beacon Knowledge Base" folder with `is_beacon_synced: true` already exists.
