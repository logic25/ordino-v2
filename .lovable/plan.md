

# Signal Integration into Properties

## Overview
Integrate **Signal** (white-labeled PropertyGuard) into Ordino's Properties module using a shared database approach. Signal monitors NYC properties for DOB violations and externally-filed applications, and provides a sales pipeline to onboard unsubscribed property owners.

---

## Phase 1: Database Schema

Three new tables, all with RLS via `is_company_member(company_id)`:

### signal_subscriptions
Tracks monitoring status per property.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| property_id | uuid FK -> properties | not null |
| company_id | uuid FK -> companies | not null |
| status | text | `active`, `trial`, `expired`, `prospect`, default `prospect` |
| subscribed_at | timestamptz | nullable |
| expires_at | timestamptz | nullable |
| owner_email | text | nullable |
| owner_phone | text | nullable |
| notes | text | sales/outreach notes |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

### signal_violations
Violations detected by Signal monitoring.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| property_id | uuid FK -> properties | not null |
| company_id | uuid FK -> companies | not null |
| agency | text | `DOB`, `ECB`, `FDNY`, `HPD`, `DEP` |
| violation_number | text | |
| violation_type | text | nullable |
| description | text | |
| issued_date | date | |
| status | text | `open`, `resolved`, `dismissed`, `pending_hearing` |
| penalty_amount | numeric | nullable |
| raw_data | jsonb | nullable, full API payload |
| created_at | timestamptz | default now() |

### signal_applications
Applications filed externally (not by Ordino), detected by Signal.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| property_id | uuid FK -> properties | not null |
| company_id | uuid FK -> companies | not null |
| job_number | text | DOB job number |
| application_type | text | e.g. NB, ALT1, ALT2, DM |
| filing_status | text | nullable |
| applicant_name | text | nullable (competitor intel) |
| filed_date | date | nullable |
| description | text | nullable |
| raw_data | jsonb | nullable |
| created_at | timestamptz | default now() |

All three tables get:
- RLS enabled
- SELECT/INSERT/UPDATE/DELETE policies using `is_company_member(company_id)`
- Indexes on `property_id` and `company_id`
- Unique constraint on `signal_subscriptions(property_id, company_id)` (one subscription per property per company)

---

## Phase 2: Data Hooks

### New files
- **`src/hooks/useSignalSubscriptions.ts`** -- CRUD for subscriptions. Query joins with properties for the list view. Includes `useEnrollProperty` mutation (creates a `prospect` subscription).
- **`src/hooks/useSignalViolations.ts`** -- Read violations for a property, with summary counts by agency.
- **`src/hooks/useSignalApplications.ts`** -- Read external applications for a property.

All hooks follow existing patterns (useQuery/useMutation with queryClient invalidation, company_id from profile).

---

## Phase 3: UI -- Property Table Enhancements

### Modified: `src/pages/Properties.tsx`
- Add filter tabs above the table: **All | Signal Active | Prospects | Not Monitored**
- Fetch signal subscriptions alongside properties and merge them
- Pass subscription data to PropertyTable

### Modified: `src/components/properties/PropertyTable.tsx`
- Add a **Signal** column header after "Owner"
- Show a status badge per row: green "Active", yellow "Trial", orange "Prospect", gray "Not Monitored"
- Add "Enroll in Signal" to the dropdown menu for properties without a subscription

### New: `src/components/properties/SignalStatusBadge.tsx`
- Small component rendering color-coded badge based on subscription status

---

## Phase 4: UI -- Signal Section in Expanded Rows

### New: `src/components/properties/SignalSection.tsx`
Rendered inside the collapsible expanded row, below the existing Projects and DOB Applications sections. Contains:

1. **Subscription Status** -- status badge + "Manage" or "Enroll" button
2. **Violations Summary** -- grouped by agency (DOB, ECB, FDNY, HPD, DEP) with open/resolved counts and total penalties
3. **External Applications** -- list of applications detected by Signal (distinct from Ordino-filed apps), each marked with a "Signal" badge to visually distinguish from internal filings

If no subscription exists, shows a prompt: "This property is not monitored by Signal. Enroll to track violations and external applications."

---

## Phase 5: Enrollment Dialog

### New: `src/components/properties/SignalEnrollDialog.tsx`
Simple dialog to create/manage a Signal subscription:
- Pre-filled property address (read-only)
- Owner email and phone fields
- Status selector (Prospect / Trial / Active)
- Notes field for sales team
- Save creates or updates the `signal_subscriptions` record

---

## Implementation Order

1. Database migration (3 tables + RLS + indexes)
2. Create `useSignalSubscriptions`, `useSignalViolations`, `useSignalApplications` hooks
3. Create `SignalStatusBadge` and `SignalEnrollDialog` components
4. Create `SignalSection` component for expanded rows
5. Update `PropertyTable` with Signal column and menu item
6. Update `Properties` page with filter tabs and data merging
7. Test end-to-end

---

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| `src/hooks/useSignalSubscriptions.ts` | Subscription CRUD |
| `src/hooks/useSignalViolations.ts` | Violation queries |
| `src/hooks/useSignalApplications.ts` | External application queries |
| `src/components/properties/SignalStatusBadge.tsx` | Status badge component |
| `src/components/properties/SignalSection.tsx` | Expanded row Signal content |
| `src/components/properties/SignalEnrollDialog.tsx` | Enrollment/management dialog |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/Properties.tsx` | Filter tabs, fetch Signal data, merge with properties |
| `src/components/properties/PropertyTable.tsx` | Signal column, badge, menu item, render SignalSection in expanded rows |

