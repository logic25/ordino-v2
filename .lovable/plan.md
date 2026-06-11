## 1. Upcoming Billing Pipeline

**Filter change** in `useBillingPipeline.ts`:
- Include services with status `not_started` or `in_progress` on `open` projects.
- Remove `billed` (a fully billed service isn't upcoming).
- Keep guards: not tied to an open/pending billing request, remaining balance > 0 (or `total > 0` for `not_started`).

**Undated services — use project fallback:**
- If `services.estimated_bill_date` is null, fall back to `projects.expected_close_date`, then `projects.due_date` (whichever exists).
- New row field `effective_bill_date` + `bill_date_source` flag (`"service"`, `"project_close"`, `"project_due"`, `"none"`).
- Sort by `effective_bill_date` ASC; items with no date at all sort last under an "Undated" group.
- In `BillingPipelineTable.tsx`: show the date with a small badge when it came from the project, and an "Undated" pill when nothing is available. Add a Status column (Not Started / In Progress).

## 2. Stale Projects pills clickable even at 0

- In `StaleProjectsCard.tsx`, make per-PM rows always open the modal (showing that PM's full open-project list with fresh/warming/stale labels).
- Make Fresh, Warming, and Stale pills standalone buttons; each opens the modal pre-filtered to that bucket.
- Total count button and "View all" stay enabled even when stale = 0 → opens the full list.
- `useDrilldownList` gains a `bucket: "fresh" | "warming" | "stale" | "all"` arg for the `stale-projects` source.

## 3. $25K company goal explained

Formula in `RevenueTrendChart.useCompanyMonthlyGoal`:
1. `companies.monthly_billing_goal_override` if set, else
2. Sum of `profiles.monthly_goal` for **active** users with role `pm`, `admin`, or `manager`.
Currently only Manny Russell ($25K active admin) contributes; Mike Johnson's $33K is on an inactive profile.

- Wrap the goal `ReferenceLine` label in a Popover that shows the formula + contributor breakdown + a deep link to `Settings → Company` to set/edit the override.
- Add an `InfoTooltip` next to the chart title summarising it.
- If a company-override editor doesn't already exist, add a simple numeric input in Company Settings (verify during implementation; only build if missing).

## 4. Resizable widgets

In `useDashboardLayout.ts`, remove `lockedFull` from:
- `proposal-followups`
- `stale-projects-total`

Keep `lockedFull` on tables/multi-panel widgets that genuinely need full width (`kpis`, `sales-health`, `billing-pipeline`, `proposal-conversion-rates`, `revenue-trend`, `team-utilization`, `team-overview`, `my-projects`).

Verify each newly-resizable widget reads cleanly at `half`.

## 5. Tooltips on every dashboard widget

Audit the admin (and PM) dashboards and ensure **every** card has an `InfoTooltip` next to its title explaining what's measured and the data source. Currently missing on at least: Billing Pulse, Revenue Trend, Team Utilization, Projects by PM, Expense Approvals, Proposal Follow-Ups, Proposals & Billing (both tabs), KPI strip pills. Each tooltip should be 1–2 short sentences.

## Changelog
Insert one `changelog_entries` row covering the four user-visible fixes.

## Out of scope
- Pixel-perfect drag-resize (keep `full | half` snap).
- Editing per-user `monthly_goal` UX (only adding/exposing the company override).
- Reclassifying services as in-progress vs not-started elsewhere in the app.

## Technical notes
- `useBillingPipeline.ts`: extend join to pull `projects.expected_close_date, due_date`; compute `effective_bill_date` and `bill_date_source` in the mapper; update sort + filter.
- `BillingPipelineTable.tsx`: add Status column, date-source badge, "Undated" pill.
- `StaleProjectsCard.tsx`: convert fresh/warming/stale spans → buttons; remove `disabled` on zero; add `bucket` to `setOpenPm` state (tuple `{pmId, bucket}`).
- `useDrilldownList.ts`: extend `stale-projects` branch with optional `bucket` filter that maps to days-since-touch ranges.
- `RevenueTrendChart.tsx`: replace plain `Label` on `ReferenceLine` with a `Popover` trigger; query active contributors to render breakdown.
- `useDashboardLayout.ts`: drop `lockedFull` from the two widgets above.
- Add `InfoTooltip` imports to each card flagged in §5.
