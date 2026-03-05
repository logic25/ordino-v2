

## Issues Identified

### 1. "General Construction" showing as a work type on the public PIS form
The proposal for this project has "General Construction" as a discipline in its proposal items. The public RFI form merges proposal disciplines into the work type picker options (lines 277-291 of RfiForm.tsx). Since the base options list only contains standard DOB work types (Architectural, Structural, Mechanical, etc.), "General Construction" gets injected from the proposal.

**Root cause**: The proposal's `disciplines` array contains "General Construction" — this is a valid proposal discipline but NOT a valid DOB filing work type. It should map to "Architectural" (or simply not appear in the PIS work type picker since it's not a DOB discipline).

**Fix**: Add a discipline-to-work-type mapping in RfiForm.tsx that normalizes proposal disciplines before merging them into the picker. Map "General Construction" → skip (or "Architectural"), and only inject disciplines that are actually valid DOB work types. Invalid/unmapped disciplines should be silently excluded from the PIS work type picker.

### 2. Directive 14 value not persisting between client form and Edit PIS
The client's public form stores `directive_14` with the key `building_and_scope_directive_14`. The Edit PIS dialog maps responses correctly (line 489-493), looking for both `prefixedKey` (`building_and_scope_directive_14`) and flat key (`directive_14`). However, there's a race condition: the `projectAutoFill` data and `rfiData` load independently, and the mapping effect runs when `rfiData` arrives. If the response key exists but the mapping logic doesn't find it, the value is lost.

Looking more closely: the response seeding works correctly for the public form (it loads from `rfi.responses`). The issue is likely that on the **internal** Edit PIS dialog, the `directive_14` value IS being loaded but the sync_pis_to_project trigger doesn't persist it to the projects table — so after submission, the project record doesn't store directive_14 separately, and the Edit PIS only shows it if the RFI responses are loaded.

**Fix**: Verify the mapping in EditPISDialog is correctly reading `building_and_scope_directive_14` from RFI responses. Add logging or check the actual database response to confirm the value exists.

### 3. Filing Type field missing from the public PIS form
Looking at the DEFAULT_PIS_SECTIONS (line 78), `filing_type` IS defined as a field in the `building_and_scope` section. The user's screenshot shows the public form without it. This could be because:
- The RFI record in the database was created with an older template that didn't include `filing_type`
- Or the field is being hidden by some conditional logic

**Fix**: Check if the specific RFI record's `sections` JSON in the database contains the `filing_type` field. If not, the template was created before this field was added. The fix would be to ensure new RFIs always use the latest `DEFAULT_PIS_SECTIONS`, and for existing RFIs, patch missing fields from the default template.

---

## Implementation Plan

### Step 1: Filter proposal disciplines from PIS work type picker
In `src/pages/RfiForm.tsx`, where proposal work types are merged into the picker options (lines 277-291), add a filter that only includes disciplines that match valid DOB work types. Create a mapping:
- "General Construction" → exclude (not a DOB filing discipline)
- Other custom proposal disciplines that don't match base options → exclude from picker

### Step 2: Ensure filing_type and directive_14 persist on the public form
In `src/pages/RfiForm.tsx`, when seeding responses from saved data (lines 302-321), ensure the response keys `building_and_scope_filing_type` and `building_and_scope_directive_14` are correctly restored. The current seeding logic copies all saved responses, so if these were saved, they should appear. The more likely issue is that this specific RFI was created with an older template missing these fields.

Add a "field patching" step in the `sections` memo that ensures `filing_type` and `directive_14` fields always exist in the `building_and_scope` section, even if the stored template doesn't include them (backcompat fix).

### Step 3: Verify Edit PIS dialog maps directive_14 correctly
In `src/components/projects/EditPISDialog.tsx`, confirm the response mapping (lines 480-518) correctly reads `building_and_scope_directive_14` and maps it to the flat `directive_14` key. This appears correct in code, so the issue may be that the RFI responses simply don't contain this key — which ties back to Step 2.

