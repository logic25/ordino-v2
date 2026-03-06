

## Improve Bug Report → Fix Workflow

### Problem
The bug reporting AI can't see Loom videos and can't apply code changes. The workflow has friction — users must manually copy bug details to bring them to Lovable chat.

### Proposed Improvements

**1. Add "Copy for Lovable" button to bug detail sheet**
- One-click button that copies a formatted bug report (description + Loom link + screenshot URLs) to clipboard
- Format it as a clean prompt ready to paste into Lovable chat
- Minimal change — add a button + clipboard logic in `BugReports.tsx`

**2. Add optional Loom transcript field**
- Add a "Transcript / Additional Context" textarea below the Loom URL input
- Users can paste the Loom transcript (Loom provides auto-generated transcripts)
- This text gets included in the bug description and sent to the AI's "Suggest Fix"
- Stored in a `transcript` or appended to the description field

**3. Improve "Suggest Fix" to include all available context**
- Pass Loom URL, transcript text, screenshot URLs, and admin notes to the `ask-ordino` call
- The AI will have much richer context for triage suggestions

### Files to modify
- `src/components/helpdesk/BugReports.tsx` — add transcript field to form, "Copy for Lovable" button to detail sheet, enrich suggestFix payload

### What this does NOT do
- Auto-apply code changes (not possible — Lovable editor is external)
- Auto-transcribe Loom videos (requires Loom API access)
- Create a staging environment (not needed for this workflow)

