

## Plan: Inbound Email Replies as Bug Comments + UI Refinements

### What Changes

**1. Rename "Admin Notes" to "Resolution Notes" in the UI**
The admin textarea label changes from "Admin Notes" to "Resolution Notes" everywhere — the management section, the reviewer view, and the resolved view. This better describes the purpose.

**2. Move Comments section below the Resolution Notes area**
Currently comments appear above the admin management section. We'll reorder so that in the detail sheet the layout is:
- Description / Screenshots / Metadata
- Resolution Notes (visible to reporter at ready_for_review/resolved)
- Comments thread (the back-and-forth)
- Admin Management section (status, assignee, resolution notes input)
- Reviewer actions
- Activity Log

**3. Inbound Email-to-Comment Feature**
Create a new edge function `receive-bug-reply` that accepts inbound email replies and posts them as comments on the corresponding bug.

**How it works:**
- When sending bug notification emails, include a unique reply identifier in the email subject (e.g., `[BUG-{bug_id_short}]`) and a `Reply-To` header or footer instruction.
- Create a new edge function `receive-bug-reply` that:
  1. Polls or is triggered when a reply comes in via Gmail sync
  2. Parses the bug ID from the subject line `[BUG-xxxxx]`
  3. Extracts the reply body (stripping quoted content)
  4. Looks up the sender's email to find their profile
  5. Inserts a `bug_comments` row with the message
  6. Triggers comment notifications to the other party

**Approach:** Since we use Gmail API (not a mail server), we'll integrate with the existing `gmail-sync` flow. During sync, if an email's subject contains `[BUG-xxxx]`, it gets routed to bug comments instead of the normal inbox. This avoids needing a separate webhook/mailbox.

### Technical Details

**Files to modify:**
- `src/components/helpdesk/BugReports.tsx` — Rename labels, reorder sections
- `supabase/functions/send-bug-alert/index.ts` — Add `[BUG-{short_id}]` tag to all outbound bug email subjects
- `supabase/functions/gmail-sync/index.ts` — Add detection for bug reply emails, auto-create `bug_comments` rows and skip normal inbox insertion
- New helper to strip quoted email content (signature, previous thread)

**Subject tagging format:** `[BUG-{first 8 chars of bug UUID}]` appended to existing subjects. On reply parsing, we match this pattern to find the bug.

**Email body parsing:** Strip everything after common reply markers (`On ... wrote:`, `---Original Message---`, Gmail's `<div class="gmail_quote">`).

