

# Automated Checklist Follow-Up Drafts

## Overview

Create a background system that automatically generates follow-up email drafts for projects with outstanding checklist items, based on days-waiting thresholds. Drafts are saved to a new table and surfaced for PM approval -- no manual "AI Follow-Up" click required.

## How It Works

1. A new edge function (`auto-checklist-followups`) runs on a schedule (daily via cron) or can be triggered manually
2. It scans all projects with outstanding checklist items where at least one item exceeds a configurable days-waiting threshold
3. For each qualifying project, it calls the existing `draft-checklist-followup` function logic to generate a draft
4. The draft is saved to a new `checklist_followup_drafts` table with status "pending_approval"
5. PMs see pending drafts on the project detail page and in a dashboard notification -- they review, edit if needed, and approve or dismiss

## Changes

### 1. New Database Table -- `checklist_followup_drafts`

Stores auto-generated drafts awaiting PM approval:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| company_id | uuid (FK companies) | |
| project_id | uuid (FK projects) | |
| draft_body | text | The generated email text |
| prompt_system | text | System prompt used (for transparency) |
| prompt_user | text | User prompt used |
| status | text | "pending_approval", "approved", "dismissed" |
| triggered_by | text | "auto" or "manual" |
| trigger_threshold_days | int | The threshold that fired this |
| items_snapshot | jsonb | Snapshot of outstanding + completed items at generation time |
| approved_by | uuid (FK profiles) | Who approved |
| approved_at | timestamptz | |
| created_at | timestamptz | |

RLS: company members can SELECT, UPDATE (for approve/dismiss), INSERT. Standard `is_company_member(company_id)` pattern.

### 2. New Edge Function -- `auto-checklist-followups`

This function:
- Queries all projects with outstanding `project_checklist_items` where any item's `requested_date` exceeds N days (default: 7, configurable per company via `company_settings.checklist_auto_followup_days`)
- For each project, checks cooldown: skip if a draft was already generated for this project within the last 72 hours (configurable)
- Gathers project context (name, address, owner, contact email) plus completed and outstanding items
- Calls the AI gateway (same prompt structure as existing `draft-checklist-followup`) to generate the draft
- Inserts the result into `checklist_followup_drafts` with status "pending_approval"
- Returns a summary of how many drafts were generated

### 3. Cron Job

A daily `pg_cron` job calls `auto-checklist-followups` at 8:00 AM ET to generate drafts before the workday starts.

### 4. Frontend -- Project Detail Page

Add a "Pending Drafts" indicator in the ReadinessChecklist component:
- When there are pending drafts for this project, show a small banner/badge: "1 auto-generated follow-up ready for review"
- Clicking it opens the existing draft dialog (reuse the current AI draft modal) pre-populated with the auto-generated content
- PM can edit, approve (which marks the draft as approved), or dismiss
- The manual "AI Follow-Up Draft" button continues to work as before for on-demand generation

### 5. Frontend -- Dashboard Notification

Add a small card or badge to the dashboard showing count of pending follow-up drafts across all projects, linking to the relevant projects.

### 6. Hook -- `useChecklistFollowupDrafts`

New hook to:
- Fetch pending drafts for a specific project (or all projects)
- Approve a draft (update status, set approved_by/at)
- Dismiss a draft

## Technical Details

### Auto-followup edge function logic (pseudocode)

```text
1. Fetch company settings for checklist_auto_followup_days
   (default 7) and cooldown_hours (default 72)
2. Query project_checklist_items WHERE status = 'open'
   AND requested_date < now() - threshold_days
   GROUP BY project_id
3. For each project_id:
   a. Check cooldown: skip if recent draft exists
   b. Fetch project details (name, address, client info)
   c. Fetch completed items for context
   d. Call AI gateway with same prompt format
   e. Insert into checklist_followup_drafts
4. Return { drafts_generated: N }
```

### Company settings addition

Add optional field `checklist_auto_followup_days` (integer, default 7) to the existing company_settings JSON. This controls the minimum days-outstanding before a draft is auto-generated. Can be configured in Settings.

## Files Modified / Created

| File | Change |
|------|--------|
| New migration | Create `checklist_followup_drafts` table with RLS |
| `supabase/functions/auto-checklist-followups/index.ts` | New edge function for scheduled draft generation |
| `src/hooks/useChecklistFollowupDrafts.ts` | New hook for fetching/approving/dismissing drafts |
| `src/pages/ProjectDetail.tsx` | Add pending draft banner and approval flow in ReadinessChecklist |
| `src/components/dashboard/DashboardStats.tsx` | Add pending drafts count indicator |
| Cron job SQL | Schedule daily execution at 8 AM ET |

