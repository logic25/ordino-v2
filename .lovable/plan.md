

## Plan: Unify Service Conditions into Project Readiness

### What's changing

The Readiness panel currently has redundant UI: "PIS Responses" collapsible (duplicates Edit PIS), "Add Item" button, and "Generate AI Checklist" button. Meanwhile, service-level "Pre-Filing Conditions" live in localStorage and don't persist or surface in Readiness.

**Goal**: Items added per-service write to the DB and show up in Readiness. Remove the duplicated/noisy buttons from Readiness.

### Changes

#### 1. Remove from Readiness panel

**`src/components/projects/tabs/ReadinessChecklist.tsx`**

- Remove the "PIS Responses" collapsible section (lines 425-464) — Edit PIS already covers this
- Remove the "Add Item" button (line 563-565)
- Remove the "Generate AI Checklist" button (lines 566-586)
- Keep: PIS status bar + Edit PIS button, checklist items display, AI Follow-Up Draft button (useful for emailing about outstanding items), Received section

#### 2. Service conditions → `project_checklist_items` table

**`src/components/projects/tabs/ServicesFull.tsx`**

- Replace `localReqs` (localStorage state) with DB-backed items from `useProjectChecklist` filtered by `source_service_id === service.id`
- "Add Condition" calls `useAddChecklistItem` with `source_service_id` set to the service ID and `source_catalog_name` set to the service name
- Checkbox toggle calls `useUpdateChecklistItem` (status open/done)
- Delete calls `useDeleteChecklistItem`
- No schema changes needed — `project_checklist_items` already has `source_service_id` and `source_catalog_name` columns

#### 3. Show service context in Readiness

**`src/components/projects/tabs/ReadinessChecklist.tsx`**

- For items with `source_catalog_name`, show a small badge next to the label (e.g., "Plumbing Plans" `[Plumbing]`)
- This happens automatically since Readiness already queries all `project_checklist_items` for the project

### Files Modified

- `src/components/projects/tabs/ReadinessChecklist.tsx` — remove PIS Responses, Add Item, Generate AI buttons; add service badge
- `src/components/projects/tabs/ServicesFull.tsx` — replace localStorage reqs with DB hooks

