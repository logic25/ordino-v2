Plan: Bug sidepanel clean-up

### What we’re fixing
1. **Duplicate AI triage**: the auto-triage edge function posts the same diagnosis twice — once as the top AI card and once as a comment. We’ll keep the card and the activity-log entry, but stop the comment copy.
2. **Inconsistent notes**: the note textarea only appears for Resolved and Ready for Review. We’ll show it for every status change with the right label, make notes optional for Open/In Progress, and required for Ready for Review/Resolved.
3. **Status clarity**: add a small helper that explains the four statuses so the team uses them the same way.

### Status meanings
- **Open** — reported, not yet being worked on or was reopened.
- **In Progress** — someone is actively investigating or fixing it.
- **Ready for Review** — a fix is done and waiting for QA / reporter to verify.
- **Resolved** — verified fixed and closed.

### Changes
- `supabase/functions/triage-bug-report/index.ts`
  - Remove the `bug_comments` insert that repeats the AI triage text.
  - Keep the `feature_requests.ai_diagnosis` update (top card) and the `bug_activity_logs` row (activity timeline).

- `src/components/helpdesk/BugReports.tsx`
  - Show the status note textarea whenever `editStatus !== selectedBug.status`, instead of only for Ready for Review / Resolved.
  - Labels per status:
    - Open: “Why is this being reopened? (optional)”
    - In Progress: “What are you working on? Anything blocking? (optional)”
    - Ready for Review: “What was done? (required)”
    - Resolved: “Resolution summary (required)”
  - Require the note only for Ready for Review and Resolved.
  - If a note is entered for Open or In Progress, post it as a comment and include it in the activity log.
  - Add a small status legend / helper line near the status dropdown.

### Not changing
- The top AI Triage card itself.
- Confirm Fixed / Still Broken buttons.
- Fix tracking fields (PR, fix version, etc.).
- The free-form Comments composer.

### Deployment
- No database migration needed.
- Edge function redeploys automatically after the file change.
- No type regeneration needed.

### Acceptance
- Open a bug: see exactly one AI triage card and one activity-log entry, no duplicate comment.
- Change status to Open or In Progress: note field appears, optional, can save without it.
- Change status to Ready for Review or Resolved: note field is required.
- Status helper text is visible in the sidepanel.