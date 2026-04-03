

# Fix: Auto-Triage Not Visible in Bug Detail Sheet

## What's Happening

The triage edge function works correctly — I just tested it and it successfully analyzed a bug and wrote the diagnosis to the database. The problems are:

1. **No data refresh after triage**: The triage call is fire-and-forget (`.catch(() => {})`). After the function completes (~3-5 seconds), the bug list query isn't re-fetched, so `selectedBug.ai_diagnosis` stays null until a manual page refresh.

2. **Existing bugs were never triaged**: All bugs submitted before the system was deployed have null `ai_diagnosis`. There's no way to trigger triage on them from the UI.

## Fix Plan

### 1. Refetch bug data after triage completes
In `BugReports.tsx`, change the fire-and-forget triage call to await the response and then invalidate the query cache so the AI triage card appears automatically.

### 2. Add "Run AI Triage" button for untriaged bugs
In the bug detail sheet, when `ai_diagnosis` is null, show a button that lets admins manually trigger triage. This covers:
- Bugs submitted before the system existed
- Cases where triage silently failed
- Re-running triage after a bug description is updated

### 3. Backfill existing bugs (one-time)
Invoke the triage function for each existing untriaged bug to populate their diagnoses. This can be triggered from the new button or done in batch.

## Files to Change

| File | Change |
|------|--------|
| `src/components/helpdesk/BugReports.tsx` | Await triage response + invalidate query; add "Run AI Triage" button in detail sheet when `ai_diagnosis` is null |

