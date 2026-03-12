

# Bug Tracker Gap Analysis

## Current State

The side panel has:
- Description (structured fields)
- Screenshots & Loom video
- Priority, Reported date, Reported By
- **Comments** (text-only thread)
- "Copy for Lovable" button
- **Management** section (admin-only): Status, Assign To, Admin Notes, Save/Delete
- Resolution Notes (shown to non-admins when resolved)
- Activity Log

## Identified Gaps

### 1. Comments are text-only — no screenshot/file attachments on comments
Chris sees a bug marked "Ready for Review," tests it, finds it still broken. He can write a comment, but **cannot attach a screenshot or file to his comment** to show the error. He has to describe it in words only. This is a major workflow gap.

### 2. Comments are NOT included in email notifications with full context
The comment email notification sends the comment text but does **not** include any prior thread context or screenshots. The recipient gets a shallow "Someone commented on Bug X" email with just the latest message.

### 3. No "Reopen" action for non-admins
The Status dropdown is admin-only. If Chris (a non-admin reporter) reviews a "Ready for Review" bug and it still fails, **he cannot reopen it or change its status**. He can only leave a comment and hope an admin sees it.

### 4. No dedicated "rejection" or "still broken" workflow
There is no structured way to say "I reviewed this and it's NOT fixed." It's just a freeform comment. A "Still Broken / Reject" button for the reviewer would make the handoff clearer.

### 5. Admin Notes are private — resolution context is one-way
Admin Notes are only shown to non-admins when the bug is resolved. During "Ready for Review," the reporter cannot see what was done to fix it, making review harder.

## Proposed Changes

### A. Add image/file attachments to comments
- Add a file upload button next to the comment input
- Upload to `bug-attachments` storage bucket under `{company_id}/{bug_id}/comments/`
- Store attachment URLs in a `comment_attachments` JSON column on `bug_comments` (or as separate metadata)
- Render inline image previews in the comment thread

### B. Add reviewer actions for non-admin reporters
- When a bug is "ready_for_review" and the current user is the reporter, show two buttons:
  - **"Confirm Fixed"** — sets status to `resolved`
  - **"Still Broken"** — sets status back to `open` (or `in_progress`), prompts for a comment
- This gives the reporter agency without exposing the full admin management panel

### C. Show admin notes to reporter during "Ready for Review"
- Make admin notes visible (read-only) to the reporter when status is `ready_for_review`, so they know what was changed before testing

### D. Include comment attachments in email notifications
- When a comment has attachments, include thumbnail links in the email HTML

### E. Migration
- Add `attachments` JSONB column to `bug_comments` table (nullable, default null)

This keeps the existing admin workflow intact while closing the reviewer feedback loop with screenshots and structured actions.

