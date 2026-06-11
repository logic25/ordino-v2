# Admin Dashboard Upgrade + Proposal Conversion Fix

## 1. New KPI strip (replaces current 4 cards)

Replace static/operational cards with momentum metrics. Card grid stays 4-wide on desktop.

| Card | Source | Click-through |
|---|---|---|
| **Active Projects** + Δ vs last month | `projects.is_active = true` (canonical) | `/projects?status=open` |
| **Active Proposals** (sent + signed_client) + $ in flight | `proposals.status IN ('sent','signed_client')`, sum `total_amount` | `/proposals?status=active` |
| **AR Outstanding** — Sent / Overdue split | `invoices.status IN ('sent','overdue')` | `/invoices?status=outstanding` |
| **Month-to-Goal** — `billedMTD / monthGoal` % | reuse `useBillingPulse` | Billing → By User tab |

Drop: Team Members (static), Outstanding $ single line, Overdue Invoices count.

Also reconcile `is_active` vs `status='active'` mismatch between `useDashboard` and `ReportsKPISummary` — pick `is_active` as canonical and update Reports.

## 2. Sales Health card (replaces Proposals Pipeline funnel)

Two panels, single card:

- **Active funnel** — proposals from last 60 days (default), grouped by status (draft / sent / signed_client / executed / lost), showing count + sum(`total_amount`). 60d is default because most close fast but occasional stragglers shouldn't be hidden; user can switch window via segmented control (30 / 60 / 90 / All).
- **Conversion** — rolling 6-month win rate (`signed_client|executed` ÷ all sent that month) sparkline + avg `sent_at → client_signed_at` days.

Keep Proposal Follow-Ups widget unchanged below it.

## 3. Resizable widgets (full / half)

- Extend `dashboard_layouts.layout` JSON: `{ order: string[], hidden: string[], widths: Record<id, "full"|"half"> }` (default full, backward-compatible).
- Wrap SortableContext in `grid-cols-1 md:grid-cols-2`. Full-width widgets span both columns via `col-span-2`.
- Add ⇿ toggle next to each widget header in edit mode. Tables (Billing By User, Pipeline, etc.) lock to full width.

## 4. Fix Upcoming Billing Pipeline

`useBillingPipeline` currently includes `not_started` services, so the card description doesn't match the data. Narrow to:
`services.status = 'billed'` AND `remaining_amount > 0` AND no open `billing_request`.
User confirmed `billed` is the trigger status. Update empty-state copy: "All billed deliverables have an open billing request."

## 5. New small widgets (default ON, half-width)

- **Cycle Times** — avg proposal sent→signed, avg invoice issued→paid (last 90d)
- **Collected vs Billed (MTD)** — two-bar mini chart
- **Stale Projects total** — count + link to `/projects?stale=stale`

## 6. Proposal → Project conversion: change orders + clock-in

Currently `useSignProposalInternal` creates `projects` + `services` but **no `change_orders`** and never prompts clock-in. Fix:

**a. Auto-create base change order on conversion**
- After project insert, create one `change_orders` row labeled "Original Scope" (status `executed`, signed using the same proposal signature), summing all `proposal_items.total`.
- Set `services.change_order_id` to that CO id when inserting the services rows (currently left null).
- This mirrors Ordino's existing CO data model so every billable service has a CO parent — needed for job-costing/margin views that already join through CO.
- Also apply the same change in `useProposalFollowUps.ts:102` duplicate conversion path (or extract a shared helper — preferred).

**b. Post-conversion clock-in modal**
- After successful conversion in `Proposals.tsx#handleSign`, open a new `<PostConversionClockInModal>`:
  - Lists the newly created services with a checkbox per item
  - "Start timer on selected" → calls existing project timer hook (`useProjectTimer`) scoped to the new project
  - "Skip" closes it
- Modal opens before/after the existing PDF preview modal (after, so the signed PDF capture isn't interrupted).

## 7. Out of scope

- react-grid-layout pixel resize, profitability dashboards, lead-source attribution, restoring Activity tab.

## Files touched

- `src/hooks/useDashboardLayout.ts` — widths schema
- `src/hooks/useDashboardData.ts` — new aggregators (activeProposals$, AR split, MTD goal, cycle times, collected vs billed, stale count)
- `src/hooks/useBillingPipeline.ts` — narrow to `status='billed'`
- `src/hooks/useDashboard.ts` + `src/components/reports/ReportsKPISummary.tsx` — reconcile active-project filter
- `src/hooks/useProposals.ts` (`useSignProposalInternal`) — base CO insert, link services
- `src/hooks/useProposalFollowUps.ts` — same (or refactor to shared helper)
- `src/components/dashboard/AdminCompanyView.tsx` — new KPI strip, grid wrapper, width toggle
- `src/components/dashboard/SalesHealthCard.tsx` *(new)*
- `src/components/dashboard/CycleTimesCard.tsx` *(new)*
- `src/components/dashboard/CollectedVsBilledCard.tsx` *(new)*
- `src/components/dashboard/StaleProjectsCard.tsx` *(new)*
- `src/components/dashboard/BillingPipelineTable.tsx` — empty-state copy
- `src/pages/Proposals.tsx` + `src/components/proposals/PostConversionClockInModal.tsx` *(new)*
- `changelog_entries` row inserted via migration

## Technical notes

- No schema changes required — `services.change_order_id` FK already exists; `dashboard_layouts.layout` is JSONB.
- All new aggregators are read-only Supabase queries respecting existing RLS (`company_id` filter).
- Widths state migration: missing `widths` defaults to `full` for every id (no breaking change for existing rows).
