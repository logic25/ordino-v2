

## Plan: Fix Work Types (Disciplines) Not Showing in Services Table

### Problem

The services table shows "—" for work types because:
1. The `disciplines` column on the `services` record is `null` — this project was converted before the disciplines-carry-over code was added
2. The planned fallback (looking up disciplines from the original `proposal_items`) was never implemented

Database confirms: service `ALT-2 D14 Approval - Regular` has `disciplines: null`, but the matching proposal item has `disciplines: [Plumbing, General Construction]`.

### Fix

**File: `src/hooks/useProjectDetail.ts`**

In `useProjectServices`, after fetching services, also fetch the project's proposal and its items' disciplines. For any service where `disciplines` is null/empty, match by name to the proposal item and use its disciplines as a fallback. Also backfill the database so the lookup only happens once.

Steps:
1. Get the project's `proposal_id` from the `projects` table (already available via the project query elsewhere, but we need it here)
2. Query `proposals` for `converted_project_id = projectId` to find the source proposal
3. Query `proposal_items` for that proposal's disciplines
4. For each service with null disciplines, match by name and apply the proposal item's disciplines
5. Fire off a background `supabase.from("services").update({ disciplines })` to persist the backfill so future loads don't need the lookup

This is a ~15-line addition to the existing `useProjectServices` function, requiring no schema changes.

### Technical Details

```text
useProjectServices(projectId)
  ├── fetch services (existing)
  ├── fetch billing_requests (existing)
  ├── fetch PIS responses (existing)
  ├── NEW: fetch proposal where converted_project_id = projectId
  ├── NEW: fetch proposal_items with disciplines for that proposal
  └── map services:
        if svc.disciplines is null → look up matching proposal_item by name
        → use its disciplines, and fire background update to persist
```

No new files. Single file edit to `src/hooks/useProjectDetail.ts`.

