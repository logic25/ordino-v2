

# Enhance AI Follow-Up Prompt with Received Items and Firm Name

## Overview

Update the AI follow-up system so the prompt includes both outstanding **and** already-received checklist items, plus the firm's name pulled from company settings. This gives the AI full project context to write more informed, professional follow-up emails.

## Changes

### 1. Edge Function -- `supabase/functions/draft-checklist-followup/index.ts`

**Accept new fields in the request body:**
- `completedItems` -- array of received/done items with label, category, and completion date
- `firmName` -- the company name from settings

**Update the system prompt:**
```
You are a professional project coordinator at {{firmName}},
an architecture/engineering firm that handles NYC Department
of Buildings filings.
...
- Acknowledge items already received to show progress and
  reinforce urgency on what remains
...
```

**Update the user prompt to include a "Received items" section:**
```
Already received:
1. "Owner Authorization Letter" -- received 01/15/2025
2. "Insurance Certificate" -- received 01/18/2025

Outstanding items:
1. "Signed Tax Returns" -- waiting on: Owner, 12 days ...
```

### 2. Frontend Caller -- `src/pages/ProjectDetail.tsx`

**Pass completed items and firm name to the edge function:**
- Import and use `useCompanySettings` inside `ReadinessChecklist` to get `companyData.name`
- Build a `completedItems` payload from the existing `completed` array (items with status "done"), including each item's `label`, `category`, and `completed_at` date
- Add both `completedItems` and `firmName` to the request body sent to the edge function

No UI changes -- the draft dialog, prompt viewer, and all buttons remain exactly as they are. The only difference is a richer, more context-aware email draft.

## Technical Details

### Edge function payload (updated shape)

```json
{
  "items": [...],
  "completedItems": [
    { "label": "Owner Auth Letter", "category": "missing_document", "completedAt": "2025-01-15" }
  ],
  "projectName": "...",
  "propertyAddress": "...",
  "ownerName": "...",
  "contactEmail": "...",
  "firmName": "Ordino Engineering"
}
```

### Revised system prompt (full text)

```
You are a professional project coordinator at {firmName},
an architecture/engineering firm that handles NYC Department
of Buildings filings.
Write a polite but firm follow-up email requesting the
outstanding items listed below.
The email should:
- Open with a professional greeting using the recipient's
  name if available
- Reference the project name and property address
- Briefly acknowledge items already received to show progress
- List each outstanding item clearly with how long it has
  been waiting
- Explain that these items are blocking the filing/project
  progress
- Close with a clear call-to-action and timeline (request
  response within 3 business days)
- Keep the tone professional but warm -- these are valued
  clients
- Do NOT include a subject line -- just the email body
- Use plain text, no HTML
```

### Revised user prompt (full text)

```
Draft a follow-up email for these outstanding checklist items:

Firm: {firmName}
Project: {projectName}
Property: {propertyAddress}
Recipient: {ownerName}
Contact email: {contactEmail}

Already received:
{numbered list of completed items with completion dates}

Outstanding items:
{numbered list of outstanding items with from_whom,
daysWaiting, category}
```

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/draft-checklist-followup/index.ts` | Accept `completedItems` and `firmName`; update both prompts |
| `src/pages/ProjectDetail.tsx` | Pass `completedItems` and `firmName` from company settings to the edge function |

