

## Plan: Add Attachments Tab to RFP Content Library

### Problem
There is no place in the RFP Content Library to upload and manage reusable files like the company logo, insurance certificates, org charts, or other miscellaneous documents that RFPs commonly request.

### Solution
Add a 7th "Attachments" tab to the Content Library. Files are stored in the existing `rfp-documents` bucket and tracked via `rfp_content` with `content_type: "attachment"`. The RFP Builder gets a matching section so users can select which attachments to include.

### Changes

**1. New file: `src/components/rfps/tabs/AttachmentsTab.tsx`**
- Grid of uploaded attachments with image thumbnails / file icons
- Upload button stores files in `rfp-documents` bucket under `attachments/` prefix
- Creates `rfp_content` record with `content_type: "attachment"` and JSON content: `{ file_path, filename, mime_type, size_bytes, description, tag }`
- Preset tag dropdown: "logo", "insurance", "org_chart", "other"
- Edit description, delete, download actions
- Auto-seed prompt: if no attachment tagged "logo" exists, show a highlighted "Add your company logo" card with upload dropzone (pre-pulls existing `logo_url` from company settings as a reference)

**2. Update `src/hooks/useRfpContent.ts`**
- Add `"attachment"` to the `ContentType` union

**3. Update `src/components/rfps/ContentLibraryTabs.tsx`**
- Add tab entry: `{ value: "attachments", label: "Files", icon: Paperclip, color: "text-muted-foreground", aliases: ["attachments", "files"] }`
- Import and render `<AttachmentsTab />`

**4. Update `src/components/rfps/RfpBuilderDialog.tsx`**
- Add section: `{ id: "attachments", label: "Attachments", icon: Paperclip, libraryTab: "attachments" }`
- When building the response, selected attachment files from `rfp-documents` are listed/included following the same pattern as certifications

### Technical notes
- No database migration needed — `rfp_content.content_type` is a text column, not an enum
- Files go to the existing `rfp-documents` storage bucket
- The logo auto-seed reads from `companies.logo_url` via `useCompanySettings`

### Response for Chris

> Hey Chris — good catch. We're adding an **Attachments** tab to the Content Library where you can upload your company logo, insurance certs, org charts, and any other files that RFPs typically ask for. When you build an RFP response, there will be an "Attachments" section where you can pick which files to include. The company logo will also be auto-prompted so it's always easy to find and attach. This should be live shortly.

