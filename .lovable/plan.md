

## Summary of All Outstanding Changes

The service status lifecycle changes (plan.md items 1-6) are **already implemented** — the migration, `auto_advance_project_phase`, reconciliation logic, `serviceStatusStyles`, and `useServiceDurationReports` are all updated. No work remains there.

The remaining items are from the PIS/proposal discussion. Here is everything that still needs to be done:

---

### 1. Move Filing Type field to Page 1 of public PIS form

**File:** `src/hooks/useRfi.ts`

The `filing_type` field (line 87) currently sits in the `applicant_and_owner` section (Page 2). Move it into the `building_and_scope` section (Page 1), inserting it after `work_types` / before `directive_14` (between lines 77 and 78). Remove line 87 from `applicant_and_owner`.

This aligns the public PIS with the internal Edit PIS dialog, which already has `filing_type` in "Building Details."

---

### 2. Add Estimated Job Cost field to internal PIS

**File:** `src/components/projects/EditPISDialog.tsx`

Add a currency/number field to the `building_scope` section (after `work_types`, before `filing_type`):
```
{ id: "estimated_job_cost", label: "Estimated Job Cost ($)", type: "number", width: "half", optional: true, placeholder: "e.g. 50000" }
```

---

### 3. Auto-fill work types from proposal disciplines in internal PIS

**File:** `src/components/projects/EditPISDialog.tsx`

In the `useEffect` that maps RFI responses (around line 415), after loading values, if `work_types` is empty and the project has a linked proposal, fetch the proposal's service items and extract their `disciplines` arrays to pre-select the work type checkboxes.

---

### 4. Auto-fill filing type from project data in internal PIS

**File:** `src/components/projects/EditPISDialog.tsx`

In the same `useEffect`, if `filing_type` is empty and the project record has `filing_type` set, seed it:
```typescript
if (!mapped["filing_type"] && project?.filing_type) {
  mapped["filing_type"] = project.filing_type;
}
```

---

### 5. Update `sync_pis_to_project` DB function for new field keys

**Migration (new SQL file)**

Update the `sync_pis_to_project()` function to:
- Read `filing_type` from `building_scope_filing_type` (current key) with fallback to `applicant_and_owner_filing_type` (legacy key)
- Map `estimated_job_cost` (from PIS responses) to `projects.estimated_value`

---

### Files changed

| File | Change |
|------|--------|
| `src/hooks/useRfi.ts` | Move `filing_type` from `applicant_and_owner` to `building_and_scope` section |
| `src/components/projects/EditPISDialog.tsx` | Add estimated job cost field; auto-fill work types from proposal disciplines; auto-fill filing type from project |
| New migration SQL | Update `sync_pis_to_project()` for new key mappings |

