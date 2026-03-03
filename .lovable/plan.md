

# Comprehensive Plan — Billing Fixes, Service Table Improvements, Invoice Visibility, Drop Flow, and CO Report / CitiSignal Rebrand

This plan consolidates all outstanding issues from recent conversations plus the CO Report overhaul and CitiSignal rebrand from the plan.md.

---

## Part A: Billing & Service Table Fixes (Priority — Bugs)

### A1. Persist service field updates to database
**File:** `src/pages/ProjectDetail.tsx` — `updateServiceField` (line 1437)
- Currently only updates local React state. Add `supabase.from("services").update()` call to persist `assigned_to` and `estimated_bill_date` to the DB.

### A2. Fix service status not updating to "billed"
**File:** `src/hooks/useBillingRequests.ts` (lines 114–138)
- The `totalBilledMap` matches by service **name** — fragile if names differ. Change to match by service **id** by including `service_id` in the billing request `services` JSON payload.
- Add `queryClient.invalidateQueries({ queryKey: ["project-services-full"] })` to `onSuccess` so the UI refreshes.

### A3. Add inline status dropdown to service rows
**File:** `src/pages/ProjectDetail.tsx`
- Replace the static status badge with a `<Select>` dropdown allowing manual transitions: `not_started → in_progress → complete → billed → dropped`.
- On change, persist to DB via `supabase.from("services").update({ status })`.

### A4. Rename "Disciplines" → "Work Types"
**File:** `src/pages/ProjectDetail.tsx` (line 1555)
- Simple header text change.

### A5. Move "Assigned" to expanded detail, add "Margin" column
**File:** `src/pages/ProjectDetail.tsx`
- Remove "Assigned" column from the main table header and rows.
- Add it to the expanded service detail section.
- Add a "Margin" column after "Cost" showing `Price − Cost` with green (positive) / red (negative) color coding.

### A6. Fix drop service — persist status & fix CO status
**File:** `src/pages/ProjectDetail.tsx` — `handleDropService` (line 1488)
- After updating local state, call `supabase.from("services").update({ status: "dropped" }).eq("id", serviceId)` for each dropped service.
- Change the CO `status` from `"voided"` to `"approved"` so the negative amount is included in the Adjusted Total calculation (the `create_services_from_approved_co` trigger will also fire, which is correct for tracking).

---

## Part B: Invoice Visibility After Creation

### B1. Auto-open invoice detail after creation
**File:** `src/components/invoices/CreateInvoiceDialog.tsx`
- Add an `onCreated?: (invoice: any) => void` callback prop.
- After successful creation, call `onCreated(invoice)` instead of just showing a toast.

**File:** `src/pages/Invoices.tsx`
- Wire `onCreated` to set the selected invoice and open `InvoiceDetailSheet`, so the user immediately sees the new invoice with its generated number.

---

## Part C: CitiSignal Rebrand (from plan.md — Task 1)

Text-only changes across 6 files. All instances of "Signal" in user-facing text become "CitiSignal." Internal code names (hooks, table names, query keys) stay unchanged.

**Files:**
- `SignalSection.tsx` — header, badge, empty state
- `SignalEnrollDialog.tsx` — dialog title, description, toasts
- `SignalSettings.tsx` — card titles, descriptions, buttons
- `PropertyDetail.tsx` — tab label, banner text, empty states
- `PropertyTable.tsx` — column header and badge
- `COSummaryView.tsx` — any Signal references in report

---

## Part D: CO Report Redesign (from plan.md — Task 2)

**File:** `src/components/properties/co/COSummaryView.tsx` — complete redesign of the report modal.

New sections:
1. **CO / TCO toggle** — selector at top; TCO mode shows life-safety requirements (fire alarm, sprinkler, standpipe, electrical) vs deferrable items
2. **Status Changes Since Last Report** — track `lastReportDate` in state; show applications that changed status, new violations, new sign-offs with before/after badges
3. **Progress Cards** — circular progress ring for overall %, sign-off grid (green/red/yellow cards), per-work-type mini cards with progress bars, violations card with penalty totals
4. **Executive Summary** — auto-generated: estimated completion timeline, blockers, risk items over $2,500
5. **Structured Next Steps** — auto-populated checklist from action summary, editable/reorderable, priority badges
6. **Report Footer** — "Prepared by [Company] via CitiSignal", data source attribution, timestamp

**File:** `src/components/properties/co/coMockData.ts`
- Add `TCO_REQUIREMENTS` array (7 items with `name`, `required`, `category`)
- Add `previousStatus` to ~5 mock applications for diff view demo

---

## Part E: CitiSignal Enrollment Gate for CO (from plan.md — Task 3)

**File:** `src/pages/PropertyDetail.tsx`
- Before rendering CO tabs (Summary, Applications, Violations), check if the property has an active CitiSignal subscription.
- **No subscription:** Show a gate card with "Enroll in CitiSignal" button → opens existing enrollment dialog.
- **Prospect/expired:** Show warning banner but allow access.

**File:** `src/components/properties/SignalEnrollDialog.tsx`
- When opened from CO context, show additional note about CO requirement.

---

## Implementation Sequence

1. **A1–A6** — Billing & service table fixes (bugs, highest priority)
2. **B1** — Invoice visibility after creation
3. **C** — CitiSignal rebrand (text-only, low risk)
4. **D** — CO Report redesign (largest UI change)
5. **E** — CitiSignal enrollment gate

