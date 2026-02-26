

# Project Detail Improvements: Unified Plan

## Summary
Six changes covering: CO-to-docs archival on execution, CO timeline triggers, unified signed contract viewing in Docs tab, project number format (YYYY-NNNN), simplified proposal viewing, and phase stepper automation.

---

## 1. Auto-Archive Executed CO to Docs

**Problem:** When a CO becomes fully executed (both sides signed), the PDF should be automatically saved to the project's Docs tab -- just like proposals.

**Current state:** `savePdfToDocuments()` already exists in `ChangeOrderDetailSheet.tsx` and is called on manual "Approve" but NOT when the client signs (which is what makes it fully executed).

**Fix (File: `src/pages/ClientChangeOrder.tsx`):**
After the client signs a CO successfully, call the `gmail-send` edge function (already done for auto-send) and ALSO insert a `universal_documents` record with `category: "change_order"` and upload the CO summary as an HTML or trigger the internal system to archive it. Since the client page doesn't have PDF generation, we'll add a database trigger instead.

**Fix (New Migration -- trigger):**
Create an `AFTER UPDATE` trigger on `change_orders`: when `client_signed_at` transitions from NULL to a value (fully executed), insert a `project_timeline_events` entry AND the system will rely on the existing `savePdfToDocuments()` call in the detail sheet's approve flow. We'll also call `savePdfToDocuments()` from the `handleApprove` path that auto-fires when both signatures are present.

**File: `src/components/projects/ChangeOrderDetailSheet.tsx`:**
Add logic so that when the sheet detects a CO is newly fully executed (both `internal_signed_at` and `client_signed_at` present), it auto-saves the PDF to documents if not already archived.

---

## 2. CO Timeline Events (Database Triggers)

**Problem:** The Timeline tab doesn't show CO activity because: (a) no triggers write CO events to `project_timeline_events`, and (b) the `TimelineFull` component in `ProjectDetail.tsx` uses `useProjectTimeline` (manual query construction) instead of `useTimelineEvents` (which reads the events table).

**Fix -- New Migration (triggers on `change_orders`):**
- `co_created` -- on INSERT
- `co_signed_internally` -- on UPDATE when `internal_signed_at` changes from NULL
- `co_sent_to_client` -- on UPDATE when `sent_at` changes from NULL  
- `co_client_signed` -- on UPDATE when `client_signed_at` changes from NULL
- `co_approved` -- on UPDATE when status becomes 'approved'
- `co_voided` -- on UPDATE when status becomes 'voided'
- `co_rejected` -- on UPDATE when status becomes 'rejected'

**Fix (File: `src/pages/ProjectDetail.tsx`):**
Update `TimelineFull` to also consume events from `useTimelineEvents` (the `project_timeline_events` table), merging them with the manually-constructed milestones from `useProjectTimeline`. Add appropriate icons for CO event types (GitBranch, PenLine, Send, CheckCheck, XCircle).

---

## 3. Signed Proposal + CO in Docs Tab (No Separate Button)

**Problem:** The user sees a separate "View Signed Contract" concept in the Proposal Execution Banner. They want to just find the signed proposal in the Docs tab alongside everything else -- view and download it there.

**Fix (File: `src/hooks/useProjectDetail.ts` -- `useProjectDocuments`):**
Add a query to check for the signed proposal file at `proposals/{proposal_id}/signed_proposal.html` in the `documents` bucket. If it exists, inject a synthetic document entry with `category: "contract"` and `name: "Signed Proposal"` into the documents list. This way it appears in the Docs tab naturally with View/Download buttons -- no separate button needed.

**Fix (File: `src/pages/ProjectDetail.tsx` -- `ProposalExecutionBanner`):**
Remove any separate "View Signed Contract" button concept. The banner remains informational only (status of signatures). The actual document lives in the Docs tab.

---

## 4. Project Number Format: YYYY-NNNN

**Problem:** Current format is `PJ2026-0001` with letter prefix. User wants year-based numeric format like `2026-01`.

**Fix -- New Migration:**
Update the `generate_project_number()` function:

```text
Format: YYYY-NN (e.g., 2026-01, 2026-02, ...)
- Year prefix so you know when it's from
- Sequential number within the year per company
- No letter prefix
```

Existing project numbers are preserved. Only new projects get the new format.

---

## 5. Header Redesign: "Number - Address - Name"

**File: `src/pages/ProjectDetail.tsx` (lines ~277-373)**

Change the h1 title to combine: `{project_number} - {address} - {name}`

Example: `2026-01 - 200 Riverside Blvd - Test 6`

Remove the project_number, address, floor/unit from the info bar below (since they're now in the title). Keep client name, owner, PM selector, and primary contact in the sub-bar.

---

## 6. Phase Stepper Automation

**Problem:** User asks if the phase stepper can be automated instead of manual clicks.

**Fix -- New Migration (trigger on services/dob_applications):**
Create a trigger function that evaluates the project's current state and advances the phase:

- **Pre-Filing to Filing**: When a `dob_applications` record is inserted for the project (i.e., a DOB application is created/filed)
- **Filing to Approval**: When all `dob_applications` for the project have `status = 'approved'`
- **Approval to Closeout**: When all `services` for the project have `status = 'completed'` or `billed`

The manual click override remains available (users can always click to set any phase). The automation just handles the common transitions so PMs don't have to remember.

**File: `src/pages/ProjectDetail.tsx`:**
No UI changes needed -- the stepper already reads `project.phase` and the triggers will update it in the DB.

---

## Technical Sequence

1. Database migration: CO timeline triggers + project number format + phase automation triggers
2. Update `useProjectDetail.ts` to inject signed proposal into docs list
3. Merge timeline sources in `ProjectDetail.tsx` (manual milestones + DB events)
4. Redesign project header layout
5. Add CO auto-archive on full execution
6. Clean up ProposalExecutionBanner (remove separate view button concept)

