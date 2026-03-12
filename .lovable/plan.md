

## Inbound Email Replies as Bug Comments + UI Refinements — Complete

### What was built:

**1. Renamed "Admin Notes" to "Resolution Notes"** ✅
- Label changed in management section and activity log descriptions
- Reporter-facing label kept as "What was changed" during ready_for_review, "Resolution Notes" when resolved

**2. Reordered detail sheet sections** ✅
- Resolution notes (for reporter) now appears right after metadata, before comments
- Order: Description → Screenshots/Video → Metadata → Resolution Notes (reporter view) → Comments → Copy for Lovable → Admin Management → Reviewer Actions → Activity Log

**3. Added `[BUG-{short_id}]` tags to all outbound bug emails** ✅
- All 4 email types (new bug, resolved, status change, comment) now include `[BUG-xxxxxxxx]` in subject
- `bug_id` passed from frontend to edge function for all invocations

**4. Inbound email-to-comment routing in gmail-sync** ✅
- During sync, emails with `[BUG-xxxxxxxx]` in subject are detected
- Reply body is extracted and stripped of quoted content (gmail_quote, "On ... wrote:", etc.)
- Sender email is matched to a company profile
- A `bug_comments` row is inserted with the reply text
- A `bug_activity_logs` entry is created with action_type `email_reply`
- The email is NOT inserted into the normal inbox (skipped)
- `stripQuotedContent()` helper handles HTML and plain-text reply stripping
