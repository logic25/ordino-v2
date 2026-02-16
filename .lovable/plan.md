
# Project Enhancements: Schema, Service Hierarchy, Mock Test Project, Litigation Timeline + DOB NOW Extension (Roadmapped)

## Overview

This plan covers: (1) database schema additions for unit/tenant fields, (2) service parent-child hierarchy for work permits, (3) Edit Project dialog enhancements, (4) a new mock project with an ALT filing (no application number) with all fields populated for testing, (5) Litigation Timeline Export feature, and (6) DOB NOW browser extension concept (roadmapped).

---

## 1. Database Migration

Add `unit_number` and `tenant_name` to the `projects` table:

```sql
ALTER TABLE public.projects
  ADD COLUMN unit_number varchar DEFAULT NULL,
  ADD COLUMN tenant_name text DEFAULT NULL;
```

No new tables needed for the service hierarchy yet since services are still mock data.

---

## 2. Edit Project Dialog Enhancements

**File: `src/components/projects/ProjectDialog.tsx`**

- Add **Unit / Apt Number** text field (after Floor Number)
- Add **Tenant Name** text field (for commercial spaces)
- Rename "External" toggle label to **"External Consultant Project"** with a helper tooltip: "Project managed by an outside consultant on your behalf"

**File: `src/hooks/useProjects.ts`**

- Add `unit_number` and `tenant_name` to the `Project` interface, `ProjectFormInput`, and the create/update mutations
- Add to the select queries

---

## 3. Work Permits as Sub-Services (Parent-Child Linking)

**File: `src/components/projects/projectMockData.ts`**

- Add `parentServiceId?: string` to `MockService` interface
- Tag Work Permit services with a `parentServiceId` pointing to their parent ALT service
- Work permits inherit the parent's job number

**File: `src/pages/ProjectDetail.tsx` (ServicesFull component)**

- Group services: render parent services normally, render children as indented rows beneath their parent with a left-border visual connector
- Children share the parent's application/job number display
- Indent children with a tree-line visual (subtle left border + padding)

```
[v] Alteration Type 1 (ALT-CO) - S00701588-I1
     |-- Work Permit (OT) - S00701588-I1
[>] Final Construction Sign-Off
```

---

## 4. New Mock Project (Set E) -- ALT Filing, No Application Number

**File: `src/components/projects/projectMockData.ts`**

Create a complete Set E mock dataset for a test project -- an Alteration Type 2 filing with NO application number yet but all other fields populated:

- **Project name**: "689 5th Ave - Alteration Type 2" (maps to the litigation example)
- **Services** (6 total):
  - ALT Type 2 Filing (in_progress, NO application -- `application: null`)
    - Work Permit (child, not_started)
  - Plan Review (complete, billed)
  - Inspection Coordination (not_started)
  - Letter of Completion (not_started)
  - Expediting (in_progress)
- All services have: assignedTo, estimatedBillDate, scopeOfWork, notes, tasks, requirements, allottedHours fully populated
- **Contacts**: 5 contacts (client, architect, engineer, GC, filing rep) with all fields filled including DOB roles, source, registration status, reviews
- **Milestones**: 8+ timeline events covering full project lifecycle
- **Change Orders**: 1 approved, 1 pending
- **Emails**: 6+ realistic emails
- **Documents**: 8+ documents across categories
- **Time Entries**: 6+ entries across services
- **Checklist Items**: 6+ items across categories (mix of done/outstanding)
- **PIS**: Sent, partially complete
- **Proposal Signature**: Fully executed

Add Set E to all export arrays. Update `getMockIdx()` in `ProjectDetail.tsx` to map projects with "689" or "5th Ave" in the name to Set E (index 4).

---

## 5. Litigation Timeline Export

This is a new feature that generates a comprehensive chronological audit trail PDF for legal defense.

### UI Entry Point

**File: `src/pages/ProjectDetail.tsx`**

- Add a "Generate Litigation Package" button in the header area (next to "Edit Project")
- Opens a dialog (`LitigationExportDialog`) with:
  - Date range picker (project start to present, adjustable)
  - Checkboxes for what to include: Emails, Phone Calls, Meetings, Documents, Timeline Events, Time Logs, Financial Summary, Critical Decisions
  - Output format: PDF or PDF + ZIP (with attachments)
  - "Generate" button that triggers the export

### New Component

**File: `src/components/projects/LitigationExportDialog.tsx`**

- Dialog with configuration options above
- On "Generate", collects all project data (mock for now):
  - Chronological timeline merging: milestones, emails, time entries, change orders
  - Communication log (all emails with full headers)
  - Document register (all attached files)
  - Critical decision points (highlighted entries where client overrode recommendations)
- Uses `@react-pdf/renderer` (already installed) to generate the PDF
- PDF sections:
  1. Cover page (project info, client, PM, date range, certification)
  2. Complete Chronological Timeline (every event sorted by date)
  3. Communication Log (emails chronological)
  4. Document Register (all files with metadata)
  5. Critical Decision Points (flagged entries)
  6. Time Log Summary
  7. Financial Summary
  8. Certification / Signature block

### New Component

**File: `src/components/projects/LitigationPDF.tsx`**

- React-PDF document component that renders the litigation package
- Styled with professional legal document formatting
- Page numbers, headers/footers, table of contents

For this phase, the PDF is generated from mock data. When real data is wired, the same component receives live data.

---

## 6. DOB NOW Filing Prep (Implemented)

Per-service side sheet that maps all Ordino data to DOB NOW fields with copy buttons, missing field highlights, pre-filing checklist, and post-filing job number entry. Triggered from "Start DOB NOW" button on services with `needsDobFiling: true`.

**File: `src/components/projects/DobNowFilingPrepSheet.tsx`**

---

## 7. DOB NOW Browser Extension (Roadmapped -- Design Only)

This is documented for future implementation, not built now. The concept:

- Chrome extension sidebar that appears when the user is on the DOB NOW BUILD website
- Shows the matching Ordino project (matched by address/BIN)
- One-click time logging from within DOB NOW
- Auto-fills DOB NOW form fields from Ordino project data (address, contacts, BBL, BIN)
- Status sync: reads DOB NOW status and updates Ordino

This requires a separate Chrome extension project and is outside the current Lovable scope.

---

## 8. Configurable Service Hierarchy (Roadmapped)

Parent-child service relationships (e.g., Work Permits under Alterations/New Buildings) should be configurable in Settings → Services rather than hardcoded. This will allow users to define which service types can be sub-services of which parent types. Currently hardcoded via `parentServiceId` in mock data.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/projects/LitigationExportDialog.tsx` | Export configuration dialog |
| `src/components/projects/LitigationPDF.tsx` | React-PDF document for litigation package |

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useProjects.ts` | Add `unit_number`, `tenant_name` to interfaces and mutations |
| `src/components/projects/ProjectDialog.tsx` | Add Unit, Tenant fields; rename External with tooltip |
| `src/components/projects/projectMockData.ts` | Add `parentServiceId` to MockService; create full Set E mock data; add to export arrays |
| `src/pages/ProjectDetail.tsx` | Service nesting logic; `getMockIdx` for Set E; Litigation Export button; import LitigationExportDialog |

## Implementation Order

1. Database migration (unit_number, tenant_name on projects)
2. Update `useProjects.ts` types and mutations
3. Update `ProjectDialog.tsx` with new fields and External tooltip
4. Add `parentServiceId` to MockService and update existing mock data to link work permits to parent ALTs
5. Create full Set E mock dataset (689 5th Ave)
6. Implement parent-child service nesting in ServicesFull
7. Build `LitigationExportDialog.tsx` and `LitigationPDF.tsx`
8. Wire litigation export button into ProjectDetail header
9. Test end-to-end
