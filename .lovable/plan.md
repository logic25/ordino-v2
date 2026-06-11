## 1. Fix blank Upcoming Billing Pipeline (root cause found)

Network shows the `services` query returning HTTP 300 with `PGRST201`:
> Could not embed because more than one relationship was found for 'projects' and 'clients'

There are two FKs from `projects` → `clients` (`client_id` and `building_owner_id`), so the nested `clients(name)` is ambiguous and **every row is dropped** — that's why the pipeline is empty even though 97 services qualify in the DB.

Fix in `src/hooks/useBillingPipeline.ts`: change `clients(name)` → `clients!projects_client_id_fkey(name)` (matches the rule in our memory about explicit FK joins). No other logic changes.

## 2. Billing / BD menu access

Leave merge decision to you — recommend **leave separate**: BD = pipeline + RFPs (BD/accounting), Billing = invoices/payments (accounting/admin). Merging would force RFP discovery into the billing screen.

What I will do now: audit `AppSidebar` so Billing is visible to **admin + accounting** only (current state uses generic `invoices` resource — confirm it's gated, tighten if not). No nav restructure.

## 3. Port "Total Open Services" widget (from legacy screenshot)

New card on Admin Dashboard + a tab in `Reports → Billing`:

| Column | Source |
|---|---|
| Open service (name) | `services.name` grouped |
| Amount | sum of remaining (`total_amount - billed_amount`) for services where `status ≠ 'billed'` |
| Qty | count |
| Avg Days | avg days since `services.created_at` (open age) |

- Hook: `useOpenServicesSummary(companyId)` aggregating in-memory from existing `services` fetch (or a Postgres view if perf needs it).
- Sortable, paginated (10/25/50), search box, total row at bottom — matches legacy layout.
- Row click → `DrillInModal` listing the underlying open services with project link.

## 4. Port "Service Level" report

New tab in `Reports` (`/reports?tab=service-level`):

| Column | Source |
|---|---|
| Service | `services.name` (grouped across all time, completed services only) |
| Avg Days | avg(`completed_date - created_at`) where `status='billed'` or `completed_date` set |
| Avg Timelog | avg sum of `time_entries.hours` per service (if `time_entries.service_id` exists) — fall back to "—" with tooltip if not wired |
| Total Days | sum of days |
| Qty | count |
| Amount | sum(`total_amount`) |

- Hook: `useServiceLevelReport({ from, to, pmId, clientId, borough })` with same filter bar as legacy screenshot.
- Default sort: Avg Days desc.
- I will check whether `time_entries` / `project_activities` already link to `service_id`; if not, Avg Timelog renders "—" and we log a follow-up rather than adding a migration in this pass.

## 5. Tooltips

Add `InfoTooltip` to the two new cards explaining the formulas.

## Out of scope

- Merging BD + Billing nav.
- New schema for service-level time logging (only if existing data isn't sufficient — will report back).
- Reworking existing dashboard layout beyond inserting the Total Open Services card.

## Files

- `src/hooks/useBillingPipeline.ts` (FK fix)
- `src/components/layout/AppSidebar.tsx` (gate audit only)
- `src/hooks/useOpenServicesSummary.ts` (new)
- `src/hooks/useServiceLevelReport.ts` (new)
- `src/components/dashboard/OpenServicesCard.tsx` (new)
- `src/components/reports/OpenServicesReport.tsx` (new tab)
- `src/components/reports/ServiceLevelReport.tsx` (new tab)
- `src/pages/Reports.tsx` (register tabs)
- `src/components/dashboard/AdminCompanyView.tsx` (insert card)
- `src/hooks/useDashboardLayout.ts` (register widget id)
- Changelog entry.
