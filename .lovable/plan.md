
# CO Report Overhaul + CitiSignal Rebrand

## What's Changing

Three things:
1. **Rebrand "Signal" to "CitiSignal"** across the entire app
2. **Redesign the CO Report** to be genuinely useful -- show CO vs TCO requirements, status changes since last report, and card-based progress visualization
3. **Add CitiSignal enrollment requirement** to the CO workflow -- every CO client must have an active CitiSignal subscription, enforced in the UI

---

## Task 1: Rebrand Signal to CitiSignal

Every user-facing reference to "Signal" becomes "CitiSignal." Internal code names (hooks, table names, query keys) stay the same to avoid breaking changes.

**Files to update (user-facing text only):**
- `SignalSection.tsx` -- header label, badge text, empty state message
- `SignalStatusBadge.tsx` -- no change needed (shows status, not product name)
- `SignalEnrollDialog.tsx` -- dialog title, description, toast messages
- `SignalSettings.tsx` -- all card titles, descriptions, button labels
- `PropertyDetail.tsx` -- tab label ("CitiSignal" instead of "Signal"), banner text, empty states
- `PropertyTable.tsx` -- column header and badge text
- `COSummaryView.tsx` -- if any Signal references exist
- `coMockData.ts` -- no user-facing text, skip

The `Radio` icon stays as the CitiSignal icon throughout.

## Task 2: Redesign the CO Report

Replace the current bare-bones report modal with a comprehensive, owner-ready report.

**New report structure in `COSummaryView.tsx`:**

### A. Certificate Type Section (new)
Add a selector at the top of the report: **"Report Type: CO / TCO"**
- **CO (Certificate of Occupancy):** Full close-out required -- all applications closed, all violations resolved, all sign-offs obtained
- **TCO (Temporary Certificate of Occupancy):** Partial close-out -- show what's minimally required vs what can be deferred. Include a "TCO Requirements" card listing: critical sign-offs needed (fire alarm, sprinkler, standpipe, electrical), active life-safety violations that must be resolved, and items that can be deferred with a Letter of No Objection

### B. Status Changes Since Last Report (new)
Track a `lastReportDate` in component state. When generating a new report, compare current data against that snapshot:
- Applications that changed status (e.g., "Permit Issued" to "Signed Off") -- show as green "Closed since last report" cards
- New violations issued since last report date
- Sign-offs obtained since last report
- Show a "Changes Since [date]" section with before/after badges

For mock purposes, add a `previousStatus` field to a few mock applications and violations to demonstrate the diff view.

### C. Progress Cards (redesigned)
Replace the plain progress bars with visual progress cards:
- **Overall Progress Ring** -- circular progress indicator showing % complete (applications closed / total)
- **Sign-Off Progress** -- X of Y sign-offs complete, displayed as a grid of colored cards (green = done, red = pending, yellow = in progress)
- **Work Type Progress Cards** -- each work type gets its own card with a mini progress bar, open/closed counts, and the top priority action item for that type
- **Violations Progress Card** -- resolved vs active with penalty total

### D. Executive Summary (enhanced)
Auto-generate a more detailed summary:
- "Based on current progress, estimated completion is [X] months at current close-out rate"
- Highlight blockers: "3 applications are blocked waiting for FDNY LOA"
- Risk items: "2 violations have penalties exceeding $2,500"

### E. Recommended Next Steps (structured)
Replace the free-text area with a structured checklist:
- Auto-populated from the action summary (e.g., "Submit LOC for 323 applications", "Obtain FDNY LOA for 48 applications")
- PM can add/edit/reorder items
- Each item has a priority badge

### F. Report Footer
- "Prepared by [Company Name] via CitiSignal"
- "Data sourced from NYC Open Data -- DOB Job Filings, DOB NOW Build, DOB Violations"
- Date and time generated

## Task 3: CitiSignal Enrollment as CO Requirement

When a PM tries to access CO tools (CO Summary, Applications, Violations tabs) or clicks "Import DOB Data," check whether the property has an active CitiSignal subscription.

**If no active subscription:**
- Show a prompt card instead of the CO content: "CitiSignal monitoring is required for CO work. Enroll this property to access CO tracking tools."
- "Enroll in CitiSignal" button that opens the existing enrollment dialog
- Note: "CitiSignal monitoring is included as part of your CO project fee"

**If subscription is prospect/expired:**
- Show a warning banner: "CitiSignal subscription is inactive. Activate to enable real-time monitoring."
- Still allow access to CO tools (data may be stale)

**In the enrollment dialog:**
- Add a note when opened from CO context: "CitiSignal is required for Certificate of Occupancy projects. Monitoring will track all DOB applications, violations, and sign-off status for this property."

---

## Technical Details

### Files to Modify

| Action | File | Change |
|--------|------|--------|
| Modify | `src/components/properties/SignalSection.tsx` | Rebrand text to CitiSignal |
| Modify | `src/components/properties/SignalEnrollDialog.tsx` | Rebrand text to CitiSignal |
| Modify | `src/components/settings/SignalSettings.tsx` | Rebrand text to CitiSignal |
| Modify | `src/pages/PropertyDetail.tsx` | Rebrand text, add CitiSignal enrollment gate for CO tabs, add Import DOB gate |
| Modify | `src/components/properties/PropertyTable.tsx` | Rebrand column header and badge |
| Modify | `src/components/properties/co/COSummaryView.tsx` | Complete report redesign with CO/TCO toggle, status changes, progress cards, structured next steps |
| Modify | `src/components/properties/co/coMockData.ts` | Add `previousStatus` to a few mock items for change-tracking demo, add TCO requirements mock data |

### Mock Data Additions (`coMockData.ts`)

```text
TCO_REQUIREMENTS = [
  { name: "Fire Alarm", required: true, category: "life-safety" },
  { name: "Sprinkler", required: true, category: "life-safety" },
  { name: "Standpipe", required: true, category: "life-safety" },
  { name: "Electrical", required: true, category: "life-safety" },
  { name: "Elevator (Temp)", required: true, category: "vertical-transport" },
  { name: "Construction Safeguards", required: false, category: "deferrable" },
  { name: "Plumbing", required: false, category: "deferrable" },
]
```

Add `previousStatus` to ~5 mock applications to demo the diff view (e.g., app #1 was "Permit Issued" last report, now "Signed Off").

### Sequence
1. Rebrand Signal to CitiSignal (all files, text-only changes)
2. Add mock data for TCO requirements and status change tracking
3. Redesign COSummaryView report modal with all new sections
4. Add CitiSignal enrollment gate to CO tabs in PropertyDetail
