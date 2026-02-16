

# Projects Table: Collapsible Services Rows with DOB Application Links

## What This Changes

The Projects table gets collapsible rows (same pattern as the Invoices table). When you expand a project row, you see its **services** (seeded from proposal line items). Each service shows its linked DOB application, or a "Start DOB NOW Application" button if none is linked yet.

## Visual Layout

```text
Project Row: PJ2026-0001 | 689 5th Ave | Client Name | Open | $4,500
  [expanded]
  ┌──────────────────────────────────────────────────────────────────┐
  │ Service                  Status        Application     Amount   │
  ├──────────────────────────────────────────────────────────────────┤
  │ Application Filing       Complete      #421639356 FA   $800     │
  │ Plan Review              Complete      #421639356 FA   $200     │
  │ Inspections Coord.       In Progress   #421639356 FA   $300     │
  │ Sign-off Obtainment      Not Started   [Start DOB NOW]  $250   │
  └──────────────────────────────────────────────────────────────────┘
  Total: $1,550 | Billed: $1,000 | Remaining: $550
```

## Mock Data (Frontend Only)

Since we're prototyping, the expanded rows will use hardcoded mock services and applications so you can see the full flow before wiring up the backend. The project header data (number, property, client, PM, status, value) continues to come from the real database.

Mock data will include:
- 4-5 services per project with varying statuses (complete, in_progress, not_started, billed)
- Some services linked to a mock DOB application (with job number and type badge)
- Some services with no application yet, showing a "Start DOB NOW Application" button
- Billing summary row at the bottom (Total / Billed / Remaining)

## Files Changed

### Modified: `src/components/projects/ProjectTable.tsx`
- Add expand/collapse state tracking (same pattern as InvoiceTable)
- Add chevron toggle on each project row
- Add nested service rows under each expanded project
- Each service row shows: name, status badge (color-coded like proposals), linked application badge or "Start DOB NOW" button, amount
- Add billing summary row at the bottom of expanded section
- Add expand/collapse all toggle in the table header

### Modified: `src/pages/Projects.tsx`
- No major changes needed -- the table component handles expansion internally

### No New Files Needed
The collapsible row logic lives entirely within the updated ProjectTable component, following the same pattern already established in InvoiceTable.

### No Database Changes
All mock data for now. The `services` table already exists with the right columns (`project_id`, `application_id`, `name`, `status`, `total_amount`, `hourly_rate`, `estimated_hours`).

## Status Badge Colors for Services
Following the same custom className pattern used for proposals:
- **Not Started**: gray/muted
- **In Progress**: blue
- **Complete**: emerald/green
- **Billed**: indigo/purple

## "Start DOB NOW" Button
For services without a linked application, a small outlined button appears in the Application column. For now it will just show a toast ("Coming soon -- DOB NOW integration"). Later this will open a pre-filled application dialog or link to DOB NOW.
