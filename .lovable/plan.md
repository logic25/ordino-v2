

# Objection Response Workflow — Gap Fixes

## What to build

### 1. Summary Preview Panel
Add a "Preview All Responses" button (e.g. top of objection list or as a toggle). Shows a read-only consolidated list of all objections with their saved notes/cleaned versions, grouped by status. This is the PM's review step before sending.

### 2. Consolidated Email with Attachments
Replace or supplement the per-objection "Send as Email" with a top-level "Send Response to Architect" action that:
- Builds an HTML email body covering ALL addressed objections (item number, code ref, response text)
- Pre-fills the architect's email from the project record
- Queries `universal_documents` for the project's uploaded plans (category = 'Plans') and the original objection sheet, attaches them to the compose dialog via `defaultAttachments`
- Falls back to per-objection send for individual items if desired

### 3. Save Package to Documents
When the PM sends or explicitly saves, generate a document (stored in `universal_documents`) containing:
- All objection responses as a single file (HTML or PDF)
- Linked to `project_id`
- Category: "Objection Responses"
- Stored in the `universal-documents` bucket

This gives a permanent record in the Documents section.

## Technical approach

### Summary Preview
- New component `ObjectionSummaryView` rendered conditionally in `ResearchWorkspace`
- Toggle state: `showSummary` boolean
- Maps over `objections` array, displays saved `resolution_notes` / `response_draft` for each
- Read-only, scrollable, with status badges

### Consolidated Email
- New handler `handleSendAllAsEmail` in `ResearchWorkspace`
- Fetches project plan documents: `supabase.from('universal_documents').select('*').eq('project_id', projectId).in('category', ['Plans', 'Objections'])`
- For each doc, fetches the file from storage bucket and converts to `AttachmentFile` format
- Builds consolidated HTML body from all non-pending objections
- Opens `ComposeEmailDialog` with `defaultAttachments` and combined body

### Save to Documents
- On send or explicit "Save to Docs" action, create a Blob/HTML string of all responses
- Upload to `universal-documents` bucket under the project path
- Insert row into `universal_documents` table with `project_id`, category "Objection Responses", timestamp filename

## Files to modify
- `src/components/projects/ResearchWorkspace.tsx` — add summary view toggle, consolidated email handler, save-to-docs handler
- May extract `ObjectionSummaryView` into its own file for cleanliness

## No database changes needed
All data structures exist (`universal_documents`, `objection_items` with `resolution_notes`/`response_draft`).

