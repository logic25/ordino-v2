

## Plan: Enrich Bug Tracker with Media Uploads, Loom Support, and Auto-Fix

### Immediate Bug Fix
The notification trigger is broken — it references columns `message` and `metadata` on the `notifications` table, but the actual columns are `body` (no `metadata` column exists). This is why you're seeing the red error toast. Must fix the trigger first.

### Changes

**1. Database Migration**
- Fix the `notify_bug_report_activity()` trigger: change `message` → `body`, remove `metadata` reference
- Add `attachments` (jsonb, default '[]') column to `feature_requests` — stores array of `{url, type, name}` for screenshots and Loom links
- Add `loom_url` (text, nullable) column to `feature_requests`
- Create a `bug-attachments` storage bucket (public) with RLS so authenticated company members can upload

**2. Update BugReports.tsx — Media in the Submit Form**
- Add a file upload area (drag-and-drop or click) for screenshots/images below the description fields
- Uploads go to `bug-attachments/{company_id}/{bug_id}/{filename}`
- Add a "Loom / Video Link" input field (optional URL)
- Store attachment URLs in the `attachments` jsonb column and loom URL in `loom_url`

**3. Update BugReports.tsx — Detail Sheet**
- Show attached screenshots as thumbnails (clickable to expand)
- Embed Loom videos inline using Loom's embed URL format (`loom.com/share/xxx` → `loom.com/embed/xxx`)
- Show all media in the detail sheet when clicking a bug row

**4. Auto-Fix Flow (Admin-Approved)**
- Add a "Suggest Fix" button on each bug detail (admin only)
- When clicked, calls an edge function `ask-ordino` (already exists) with the bug description + page context to generate a suggested fix description
- Shows the AI suggestion in the detail sheet
- Admin can approve/reject the suggestion
- On approval, the bug status moves to `in_progress` and the fix description is saved to `admin_notes`
- This doesn't auto-edit code (that's not possible at runtime), but it gives a clear, actionable fix description that can be brought back here to implement

**5. Chris's PDF Items**
The PDF contains 6 specific bugs from Chris. After this enrichment is built, we'll go through each one and enter them as proper bug reports with screenshots attached. That's the "review 1 by 1" workflow — each item becomes a tracked bug with media.

### Files Changed
- **New migration**: Fix trigger, add columns, create storage bucket
- **`src/components/helpdesk/BugReports.tsx`**: Add file upload, Loom URL input, media display in detail sheet, auto-fix button

### Technical Notes
- Storage bucket uses existing RLS pattern (company member check)
- Loom embed detection: regex match `loom.com/share/` and convert to embed iframe
- Attachments stored as jsonb array to support multiple files per bug

