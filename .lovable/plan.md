

# Reorganize Proposal Wizard: Add "Parties & Plans" as Step 2

## Overview

Restructure the proposal wizard from 3 steps to 4 steps, pulling Project Parties out of Step 1 and combining them with a new Plans Upload section in a dedicated Step 2 that can be skipped.

## New Step Flow

```text
Step 1: Property & Contacts  (unchanged minus parties)
Step 2: Parties & Plans       (NEW - skippable)
Step 3: Services              (was Step 2)
Step 4: Details & Terms       (was Step 3)
```

Step 2 includes a "Skip" button in the footer so users can jump straight to Services when they don't have party/plan info yet.

## What Changes

### 1. ProposalDialog.tsx - Step restructure

- Update `STEPS` array to 4 entries:
  - `{ key: "property", label: "Property & Contacts" }`
  - `{ key: "parties", label: "Parties & Plans" }`
  - `{ key: "services", label: "Services" }`
  - `{ key: "details", label: "Details & Terms" }`
- Move the `Project Parties` section (PartyInfoSection) out of Step 1 into Step 2
- Add Plans Upload section below Project Parties in Step 2
- Add a "Skip" button next to "Next" on Step 2 that advances to Step 3
- Add `job_description` field to the form schema
- Adjust all `step === N` conditions (services becomes `step === 2`, details becomes `step === 3`)

### 2. PlansUploadSection.tsx (new component)

- Drag-and-drop file upload zone (PDF, PNG, JPG)
- Files upload to `universal-documents` storage bucket with category "Plans"
- Uploaded file list with remove buttons
- "Analyze Plans" button that calls the `analyze-plans` edge function
- Extracted job description shown in an editable Textarea
- Writes to the form's `job_description` field

### 3. analyze-plans edge function (new)

- Accepts storage file URLs
- Sends to Lovable AI gateway (Gemini 2.5 Pro for vision/document analysis)
- Prompt instructs it to extract a job description suitable for a DOB Project Information Sheet
- Returns `{ job_description: string }`

### 4. Database migration

- `ALTER TABLE proposals ADD COLUMN job_description text;`
- `ALTER TABLE universal_documents ADD COLUMN proposal_id uuid REFERENCES proposals(id);`

### 5. useProposals.ts

- Include `job_description` in create/update mutations and select queries

### 6. EditPISDialog.tsx

- When loading PIS for a project linked to a proposal, pre-fill `job_description` from the proposal if the PIS field is empty

## Files to Create/Edit

| File | Action |
|------|--------|
| `src/components/proposals/ProposalDialog.tsx` | Edit - 4-step flow, move parties, add plans section, skip button |
| `src/components/proposals/PlansUploadSection.tsx` | Create - Upload UI + AI analyze button |
| `supabase/functions/analyze-plans/index.ts` | Create - AI extraction edge function |
| `src/hooks/useProposals.ts` | Edit - Add job_description to mutations/queries |
| `src/components/projects/EditPISDialog.tsx` | Edit - Pre-fill job description from proposal |
| Database migration | Add job_description column, proposal_id FK |

## Skip Button Behavior

On Step 2, the footer shows:
- "Back" (goes to Step 1)
- "Skip" (outline style, jumps to Step 3 without validation)
- "Next" (goes to Step 3, same as Skip but implies intent to fill)

This keeps the fast-track path for users who don't have plans or party info at proposal time.
