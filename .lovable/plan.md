
# Client Health module — Phase 1 (revised)

Goal: answer "how are we doing at winning new customers and retaining old ones?" without adding drift-prone columns. One SQL view, one report page, honest labels.

## Placement — no new sidebar item

Lives as a new tab under **Reports** (`/reports` → "Client Health" tab). It is a report, and Reports already houses cross-entity read-only analytics. Also surface a "View in Reports" link from the Companies (`/clients`) page header so it's discoverable from the natural entry point. No sidebar change.

## Schema check (verified, not assumed)

Confirmed in `proposals`:
- `sales_person_id` 28/59, `created_by` 52/59, `assigned_pm_id` 54/59 — overlap `sp = cb` 20, `sp = pm` 24 (three distinct concepts)
- `lead_source` (varchar, 45/59), `total_amount`, `sent_at` **40/59**, `converted_at` **43/59**, `converted_project_id`, `client_id`
- `status` enum: `draft, sent, viewed, signed_internal, signed_client, accepted, rejected, expired, lost, executed` — no `converted` / `in_progress`
- `lead_sources`, `client_payment_analytics`, `clients.expected_annual_value` all present

## Decisions (from your review)

1. **Conversion signal:** `converted_at IS NOT NULL`. "In progress" = the linked project's status is not closed. Approved.
2. **Owner field:** `COALESCE(sales_person_id, created_by)` + new boolean `owner_is_inferred` (true when it fell back). UI shows a small "inferred" tag on those rows so a future review can tell confirmed ownership from a guess. Approved.
3. **Concentration flag:** default rule `active_project_count ≤ 2 AND ytd_proposed_value < 0.5 × expected_annual_value`, but **shipped in "pilot" mode**: computed by the view and shown in an admin-only preview list first. Badge stays off in the main table until you eyeball the flagged list and confirm it isn't catching legitimately small accounts. One-line toggle in `client_health_settings` flips it live.
4. **NULL `sent_at` handling:** proposals with `sent_at IS NULL` are excluded from `first_proposal_date`, `last_activity_date`, `ytd_proposed_value`, and `ytd_conversion_rate`. A `has_incomplete_data` flag on the view is true when any proposal for that client is missing `sent_at`; UI shows a subtle "data incomplete" tag on those rows so nobody gets flagged dormant just because a proposal wasn't timestamped.
5. **Sales_person_id fill rate:** add a tiny "Data quality" strip at the top of the Client Health tab showing current fill rate (`sales_person_id` / proposals with `sent_at`) so you can watch whether it's improving or stuck at ~47%. If stuck, the fix is upstream (proposal form), not another fallback.

## Data model — `public.client_health` view

Live SQL view, no stored columns, no triggers. Per client, computed from proposals (excluding NULL `sent_at` for date aggregates) + `client_payment_analytics`:

- `first_proposal_date` = MIN(sent_at)
- `last_activity_date` = MAX(COALESCE(converted_at, sent_at))
- `active_project_count` = count of proposals with `converted_project_id` where joined project is not in a closed status
- `ytd_proposed_value` = SUM(total_amount) where sent_at in current calendar year
- `ytd_conversion_rate` = (count converted_at NOT NULL this year) / (count sent this year)
- Pass-through from `client_payment_analytics`: `total_lifetime_value`, `payment_reliability_score`, `avg_days_to_payment`
- Flags: `is_dormant` (today − last_activity_date > threshold), `is_concentrated` (rule above), `has_incomplete_data`, `owner_is_inferred` per-proposal (aggregated as `any_owner_inferred` on the client row)

Thresholds live in a one-row-per-company `client_health_settings` table (default dormancy 90 days, concentration ratio 0.5, concentration_badge_enabled=false initially).

Perf: 3,250 × 7,000 is fine as a plain view with indexes on `proposals(client_id, sent_at)` and `proposals(client_id, converted_at)`. Promote to materialized + nightly refresh only if p95 > 500ms.

## UI (all under `/reports` → Client Health tab)

1. **Data quality strip** — sales_person_id fill rate + count of clients with `has_incomplete_data`.
2. **Client Health table** — sortable/filterable. Columns: Name, **Proposed YTD (labeled "Proposed, not billed")**, YTD conversion %, Active projects, Days since last activity, First proposal, Lifetime billed, Reliability score. Row tags: Dormant, Concentrated (hidden until pilot approved), Data incomplete, Inferred owner.
3. **Filter bar** — owner (COALESCE field), lead source, date range, dormant-only, incomplete-only.
4. **Concentration pilot preview** — admin-only sub-view listing exactly which clients the concentration rule would flag today, so you can eyeball CBRE/JLL vs false positives before enabling the badge.
5. **CSV export** of the filtered table view.

## Cross-cutting

- **Owner + source filters** added to existing dashboard/report charts that currently ignore them (same COALESCE owner semantics, same `lead_source` field). Audit list produced during build.
- **Unified proposals export** — one shared function behind every chart's Export button: proposals joined with client + project + `total_amount`, `sent_at`, owner, `lead_source`, `status`, `converted_at`. Filters: date range, owner, lead_source, status. Replaces per-chart CSV code.

## Explicitly deferred (separate tickets)

- **Cohort views** (new-clients-by-month, retention-by-cohort) — gated behind the 2013→ legacy proposals migration.
- **DOB reverse-BD / share-loss** — one shared fuzzy name-match service over DOB NOW Socrata (`w9ak-ipjd`), consumed by both Client Health ratio and reverse-BD tool, with manual review queue and share-loss vs demand-loss classification.

## Acceptance criteria mapping

- No new columns on `proposals` or `clients`; `client_health` is a view
- Every $ figure labeled proposed / billed / collected
- View joins `client_payment_analytics`, doesn't recompute
- Owner + source filters added to existing dashboard charts
- Cohorts + DOB matching not shipped in this phase
- `owner_is_inferred` and `has_incomplete_data` surfaced in the view and UI
- Concentration flag ships in pilot preview only, badge disabled until you approve

## Technical notes (safe to skip)

- Migration: `CREATE VIEW public.client_health` + `GRANT SELECT ... TO authenticated` (views inherit underlying RLS); tiny `client_health_settings` table with company-scoped RLS.
- New hook `useClientHealth` (React Query, filter args).
- Files: `src/pages/Reports.tsx` gains a "Client Health" tab; `src/components/reports/ClientHealthTab.tsx`, `src/components/reports/ClientHealthTable.tsx`, `src/components/reports/ConcentrationPilotPreview.tsx`, `src/lib/exports/proposalsExport.ts`.
- No edge functions required.
