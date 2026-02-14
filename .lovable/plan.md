

# RFP Tracker Enhancements: Table View, Notes, and Insurance Tracking

## What We're Building

Three improvements to the `/rfps` page:

1. **Kanban / Table view toggle** -- add a table/list view alongside the existing Kanban so users can see all RFPs in a sortable, date-focused format
2. **Add a `notes` column to `rfps`** -- for ongoing tracking notes (e.g., "they want higher umbrella insurance", "waiting on M/WBE sub quotes")
3. **Add an `insurance_requirements` JSONB column** -- to track specific insurance asks per RFP (general liability, workers comp, umbrella amounts)
4. **More seed data** -- add 5-8 more RFPs across statuses with realistic notes and insurance details so both views look populated

---

## Database Migration

Add two new columns to the `rfps` table:

- `notes text` -- free-form internal notes
- `insurance_requirements jsonb` -- structured insurance data like `{ general_liability: "$1M", workers_comp: "Statutory", umbrella: "$5M" }`

Insert 6 additional sample RFPs with varied statuses, dates, notes, and insurance requirements. Update the existing 5 RFPs to also have notes and insurance data.

---

## UI Changes

### View Toggle (Kanban vs. Table)

Add a toggle in the `/rfps` page header (using `LayoutGrid` / `List` icons) to switch between Kanban and Table views. State stored locally with `useState`.

### Table View (`RfpTableView` component)

A sortable table with these columns:

| Column | Details |
|--------|---------|
| Title | RFP name, clickable (future: links to detail) |
| RFP # | Monospace font |
| Agency | Agency name |
| Status | Color-coded badge (reuse `RfpStatusBadge`) |
| Due Date | Formatted date + urgency indicator (overdue in red, upcoming in yellow) |
| Submitted | Date submitted (if applicable) |
| M/WBE Goal | Min-Max % range |
| Insurance | Summary badges showing key requirements |
| Contract Value | For won RFPs, tabular-nums |
| Notes | Truncated preview, full text on hover via tooltip |
| Actions | Status dropdown to change status inline |

Sortable by due date (default), status, agency. Search/filter bar for title and RFP number.

### Notes Column in Both Views

- **Table view**: Shows first ~60 chars with a tooltip for full text; click to open inline edit
- **Kanban cards**: Show a small note icon + truncated note text if notes exist

### Insurance Requirements Display

- **Table view**: Show as compact badges (e.g., "GL $1M", "WC Statutory", "Umb $5M")
- **Kanban cards**: Show a shield icon if insurance requirements exist

---

## Technical Details

### Files Modified
- `src/pages/Rfps.tsx` -- Add view toggle state, render either Kanban or Table
- `src/components/rfps/RfpKanbanBoard.tsx` -- Add notes preview and insurance icon to cards
- `src/hooks/useRfps.ts` -- Add `useUpdateRfpNotes` mutation

### Files Created
- `src/components/rfps/RfpTableView.tsx` -- Full table view component with sorting, filtering, inline notes, insurance badges

### Database Migration
- `ALTER TABLE rfps ADD COLUMN notes text, ADD COLUMN insurance_requirements jsonb`
- `UPDATE` existing 5 RFPs with notes and insurance data
- `INSERT` 6 new RFPs with varied statuses, agencies, dates, notes, and insurance requirements

### Sample Data (11 total RFPs after seeding)

Existing updates:
- NYCEDC Expeditor: notes = "Need to confirm umbrella coverage increase to $10M. Check with broker."
- NYCHA Queensbridge: notes = "Pre-bid conference Feb 20. Bring M/WBE sub list."
- Columbia Phase 3 (won): notes = "Excellent relationship. They requested we bid Phase 4."
- Parks Pavilion (lost): notes = "Lost to firm with LPC specialist. Consider partnering with LPC consultant next time."
- DOE PS 234 (submitted): notes = "Submitted 3 days early. Waiting for shortlist notification."

New RFPs:
1. NYCEDC Willets Point Infrastructure (prospect, due Apr 2026)
2. SCA School Safety Upgrades (drafting, due Mar 2026)
3. MTA Station Accessibility (prospect, due May 2026)
4. NYCHA Red Hook Boiler Replacement (submitted, due Jan 2026)
5. Private - 520 Fifth Ave Lobby Renovation (won, $42K)
6. HPD Affordable Housing Compliance (lost)

Each will have realistic notes and insurance requirements.

