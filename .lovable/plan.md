

## Analysis

I queried the database and confirmed the public PIS responses **are saved correctly**:
- `building_and_scope_directive_14: "Yes"` 
- `building_and_scope_work_types_selected: ["General Construction"]`
- `building_and_scope_work_types_cost_general_construction: 324232`
- No `filing_type` stored (field was missing from the old template — now patched)

The submit experience ("All Done" screen with Edit Responses button) is correct behavior. The page shouldn't close — it confirms submission and allows edits.

### Why data isn't populating on the internal Edit PIS

The root cause is a **section ID mismatch** between the two forms:

| Public PIS (RfiForm) | Edit PIS (EditPISDialog) |
|---|---|
| `building_and_scope` | `building_scope` |
| `applicant_and_owner` | `applicant` / `owner` |
| `contractors_inspections` | `gc` / `tpp` / `sia` |

The Edit PIS mapping has a fallback that searches for keys ending with `_fieldId`, which should catch most fields. However:

1. **Cost field mismatch**: The public form stores **per-work-type costs** (e.g., `building_and_scope_work_types_cost_general_construction: 324232`). The Edit PIS has a single `estimated_job_cost` field. These keys don't match at all, so the cost never populates.

2. **Fragile fallback**: The `endsWith` fallback could match the wrong key if multiple keys share the same suffix.

## Plan

### Step 1: Map per-work-type costs to estimated_job_cost
In `EditPISDialog.tsx`, after the standard field mapping loop, add logic to sum all `_work_types_cost_` response keys into the `estimated_job_cost` field if it wasn't already set.

### Step 2: Verify D14 and other fields populate via fallback
The fallback logic at lines 498-505 should already handle directive_14 and other mismatched section IDs. I'll add a dedicated mapping step that explicitly checks the known public-form key patterns (`building_and_scope_*`, `applicant_and_owner_*`, `contractors_inspections_*`) to make the mapping robust rather than relying on `endsWith`.

### Step 3: Confirm submit UX
No code change needed — the "All Done" screen is the intended behavior. The page stays open so the client can review or edit.

