## Goal
Make Billing by User reflect **send-to-billing** activity (not invoices), exclude reimbursable filing fees from goal math, default to goal-holders, auto-include anyone who sends to billing, per-month goals with overrides, backlog context, drop Activity tab.

## What I found about the current "reimbursable" workflow
I checked the schema and live data:

- `billing_requests.services` is jsonb with keys: `service_id, name, rate, quantity, amount, billed_amount, billing_value, billing_method, previously_billed, remaining_after, description`. **No `is_reimbursable` or expense-type flag** on the line items.
- `services.billing_type` exists but every row in your data is `"fixed"` — it isn't being used to mark reimbursables.
- `project_expenses` has a `billing_request_id` FK (the schema clearly anticipated linking reimbursable expenses to a billing request), but **0 of your `project_expenses` rows are linked** to a billing_request today. So in practice filing fees are being sent through `billing_requests.services` as regular line items and there's no signal separating them from fee work.

**Result:** today there's no automatic way to tell which portion of a billing_request is a reimbursable filing fee vs PM fee work. We need to introduce that signal before we can exclude reimbursables from goal totals. Two options below — recommending the first.

## Reimbursable signal (new, smallest change that works)
Add `is_reimbursable boolean default false` to `services`. The send-to-billing UI already pulls service lines into the `billing_requests.services` jsonb; we'll also write `is_reimbursable` into each line at send time. Then aggregation can do `SUM(billed_amount) FILTER (WHERE NOT is_reimbursable)` for the goal totals.

- Existing rows in `services`: default to `false`. Admin can flip filing-fee services to `true` in Settings → Service Catalog (one-time backfill — quick to do once we have the column).
- Existing `billing_requests` rows: treat as 100% non-reimbursable for historical purposes (we'll note this in the tooltip).

(Out of scope for this pass: switching the workflow to use `project_expenses → billing_request_id` for reimbursables. We can revisit if you actually want filing fees on a separate workflow rather than just flagged.)

## Changes

### 1. Data source — billing_requests
Rewrite `useMonthlyBillingByUser(year)` against `billing_requests`:
- Scope to current `company_id` and `EXTRACT(YEAR FROM created_at) = year`.
- Group by `created_by` and month of `created_at`.
- Per row, compute `fee_amount = SUM(line.billed_amount WHERE NOT line.is_reimbursable)` and `reimbursable_amount = SUM(line.billed_amount WHERE line.is_reimbursable)` over the jsonb services array.
- Returned per (user, month): `{ fee, reimbursable }`.

### 2. Who appears — default goal-holders, auto-include billers
Row set = union of:
- Active profiles in the company with `monthly_goal > 0` (always shown), and
- Any profile with ≥1 `billing_requests` row in the selected year (so a user appears the moment they send to billing, even without a goal).

Users without a goal show "—" in goal/vs-goal cells. Sort by YTD fee desc.

### 3. Per-month goal cells + YTD column
Each Jan–Dec cell, two lines:
- Top: **fee** billing for that month (the number that counts toward goals). "—" if zero.
- Sub: `/ $goal`, color-coded (red <50%, amber 50–90%, green ≥90%). Blank when user has no goal; future months show goal only, no color.

If any reimbursable was billed that month, show a tiny gray `+$X reimb` tag under the fee line (informational only, never counted).

Keep the **YTD vs Goal** rollup column at the end (sum fee ÷ sum monthly goal through current month).

### 4. Per-month goal overrides
Default month goal = `profiles.monthly_goal`. New table:

```text
user_monthly_goals
  user_id uuid, company_id uuid, year int, month int, goal_amount numeric
  unique (user_id, year, month)
```

Admin-only popover on a goal sub-line: set or clear a single month's override. No bulk editor in this pass.

### 5. Backlog (pipeline context) column
**Backlog** after Total: sum of signed/executed proposal `contract_amount` for projects where the user is PM and the project isn't fully billed. Tooltip: "Signed work assigned to this PM that hasn't been sent to billing yet. Goals are flat — backlog is context, not a target." Totals row aggregates.

### 6. Drop the Activity tab
Removed. Tabs become **Proposal Conversion** | **Billing by User**.

### 7. Tooltip refresh
Update card InfoTooltip: source = "amounts sent to billing (billing requests), grouped by who sent them, fee work only — reimbursables shown separately and never count toward goals."

## Files touched
- Migration 1: `ALTER TABLE services ADD COLUMN is_reimbursable boolean NOT NULL DEFAULT false;`
- Migration 2: `user_monthly_goals` table + RLS (company members read, admins write), `service_role` grant, `updated_at` trigger.
- `src/components/settings/...` — small checkbox in the service editor for "Reimbursable / pass-through (don't count toward billing goals)".
- Send-to-billing code path — when constructing the jsonb line, copy `is_reimbursable` from the `services` row.
- `src/hooks/useDashboardData.ts` — rewrite `useMonthlyBillingByUser` against `billing_requests` with the fee/reimbursable split; add `useUserMonthlyGoals(year)`; add `useUserBacklog()`; remove `useRecentProposalActivity`.
- `src/components/dashboard/ProposalConversionTable.tsx` — drop Activity tab, rebuild Billing cells with the fee/reimbursable display, Backlog column, override popover.
- Changelog entry.

## Out of scope
- Migrating filing-fee workflow to `project_expenses.billing_request_id` (separate decision).
- Backfilling which existing services are reimbursable (you'll flip the toggle once on the filing-fee service definitions).
- Weekly breakdown tables from the screenshot.
- Bulk goal editor.
