

## Plan: Fix Proposal Dialog UX Issues

Based on Chris's feedback and your testing, here are the issues identified and what needs to be fixed:

### Issues Found

**1. Work Type Selector Not Discoverable**
The work type picker is hidden inside the expanded view of each service line item (click the chevron). For services like "ALT-2 Non-D14 Approval" and "Work Permit," the `show_work_types` flag in the Service Catalog may not be enabled, so the disciplines section never appears. Additionally, the Service Catalog settings page needs an "Edit" action on existing services (currently only has Add/Delete).

**2. Cannot Edit a Service in Service Catalog**
The Service Catalog in Settings only allows adding new services and toggling the work type checkbox. There is no edit button or click-to-edit functionality for existing services, so users cannot modify descriptions, prices, or enable work types after creation.

**3. License Type and License Number Not Shown**
The fields exist in the Architect/Engineer party section (Step 2), but they may not be rendering on the proposal preview PDF or the project detail view. Need to verify and ensure these fields appear on the `ProposalPreviewModal` output.

**4. Cannot See Next Service Being Added (Scroll Issue)**
The services step (Step 3) uses `overflow-y-auto` on the outer container but the inner content area may not be scrolling properly when many services are added. The auto-appended empty row at the bottom may be clipped.

**5. Classification Step Feels Disjointed**
Step 4 (Details and Terms) contains Classification, Assignment, Financial, and Terms all in one page. The jump from Services to this catch-all step feels abrupt. Will reorganize the visual hierarchy and spacing.

### Changes

**A. Add Edit functionality to Service Catalog** (`src/components/settings/ServiceCatalogSettings.tsx`)
- Add an "Edit" button to each service row that opens the same dialog pre-filled with existing values
- Allow saving changes back to the service catalog

**B. Fix Service Step scrolling** (`src/components/proposals/ProposalDialog.tsx`)
- Ensure the services container properly scrolls when many items are added
- The empty auto-appended row should always be visible at the bottom

**C. Ensure License Type/Number appear on Proposal Preview** (`src/components/proposals/ProposalPreviewModal.tsx`)
- Add architect license type and license number to the preview output under the Prepared For or Project Parties section

**D. Improve Step 4 layout** (`src/components/proposals/ProposalDialog.tsx`)
- Add clearer visual separation between Classification, Assignment, Financial, and Terms sections
- Consider moving Classification fields earlier or making the flow feel more natural

**E. Add "Analyze work type per plans" to roadmap** (informational only)
- This is a future AI vision feature: analyzing uploaded architectural plans to auto-detect disciplines (plumbing, HVAC, electrical, etc.)
- Will note this as a roadmap item, no code change needed now

### Technical Details

- **Service Catalog Edit**: Reuse the existing "Add New Service" dialog component, passing the selected service as initial values and switching the submit handler from `append` to `update` on the settings array
- **Scroll fix**: The Step 3 container at line 1088-1119 needs the inner `div.flex-1` to have explicit `overflow-y-auto` and `min-h-0` to work within the flex layout
- **License fields on preview**: Add `architect_license_type` and `architect_license_number` from the proposal data to the preview modal's party info section
- **Step 4 spacing**: Add `Separator` components and adjust padding between the Classification/Assignment/Financial/Terms sections

