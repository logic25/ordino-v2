## Dashboards plan

### Role → dashboard mapping (locked)
| Role | Who today | Dashboard |
|---|---|---|
| `admin` | Chris, Manny | **AdminCompanyView** — new "see everything" merged view |
| `accounting` | (none yet) | **AccountingView** — unchanged |
| `production` | Natalia, Sheri, Green Light | **PMDailyView** — renamed "Production" in role-preview selector |

- Drop the `manager` dashboard from the live app (no one has that role). Keep the `ManagerView.tsx` file but stop routing to it. Admin no longer needs to preview-as-manager because everything moves into Admin.
- `RolePreviewSelector` becomes: **Admin / Production / Accounting** (3 options, matches reality).
- Staff (production, accounting) cannot switch to Admin view — preview selector is admin-only (already enforced via `actualRole`).

### New Admin "see everything" layout
Single scroll, sectioned. All cards on one page; no tabs.

```text
┌─ Company KPIs (4 cards) ──────────────────────────────────┐
│  Active Projects · Team Members · Outstanding · Overdue    │
├─ Revenue Trend (full width, period selector) ──────────────┤
├─ YoY Chart  │  Proposal Activity (last 30/90d)             │
├─ Proposals Pipeline by Stage (NEW, full width) ────────────┤
│  Draft · Sent · Signed · Won · Lost — count + $ value      │
├─ Team Utilization │ Projects by PM (from Manager view) ────┤
├─ Accounting summary strip (NEW) ───────────────────────────┤
│  Pending billing · Overdue invoices · Active promises ·    │
│  Aging mini-chart — links into /billing                    │
├─ Proposal Follow-Ups (full width) ─────────────────────────┤
├─ Billing Goal Tracker ─────────────────────────────────────┤
├─ Expense Approvals ────────────────────────────────────────┤
└─ Team Overview (roster) ───────────────────────────────────┘
```

All sections respect the existing `DashboardLayoutConfig` toggle so Admin can hide any card they don't want.

### New widget: Proposals Pipeline by Stage
- Funnel-style card. One row per stage: **Draft, Sent, Signed (client), Won (executed), Lost**.
- Each row: count + total `$` value, click-through to `/proposals?status=<stage>`.
- Data source: existing `proposals` table grouped by `status`, summing `total_amount`, scoped by `company_id`. New hook `useProposalsPipeline()` in `src/hooks/useDashboardData.ts`.
- Component: `src/components/dashboard/ProposalsPipelineCard.tsx`.

### Accounting summary strip on Admin
- Reuses data from `useAccountingDashboard()` (already exists).
- Renders 3 KPI tiles + a compact aging mini-chart (reuse `AgingSummaryChart`).
- Component: `src/components/dashboard/AccountingSummaryStrip.tsx`.

### Team visibility bug fix (the "2 of 4" issue)
Confirmed in `src/hooks/useDashboardData.ts`:
- `useTeamUtilization` drops any active member with **no hours AND no PM-assigned projects**.
- `useProjectsByPM` only seeds from project rows, so PM-less members never appear.

Fix: seed both queries from **all active company profiles** (`profiles` filtered by `company_id` + `is_active = true`), then left-join hours/projects. Every active teammate shows up with zeros where applicable. Drop the silent `filter` that hides zero-rows.

### Files touched
- `src/pages/Dashboard.tsx` — drop `manager` case; map `production` explicitly to PMDailyView.
- `src/components/dashboard/RolePreviewSelector.tsx` — Admin / Production / Accounting options.
- `src/components/dashboard/AdminCompanyView.tsx` — add Pipeline card, Team Utilization + Projects by PM, Accounting summary strip; keep current order otherwise.
- `src/components/dashboard/ProposalsPipelineCard.tsx` — **new**.
- `src/components/dashboard/AccountingSummaryStrip.tsx` — **new**.
- `src/hooks/useDashboardData.ts` — fix `useTeamUtilization` + `useProjectsByPM`; add `useProposalsPipeline`.
- `src/hooks/useDashboardLayout.ts` — register the two new widget IDs.
- `changelog_entries` — log "Admin dashboard: pipeline, accounting, team utilization merged; fixed team visibility."

No DB schema changes, no RLS changes, no edge functions. Backend only via existing queries.

### Out of scope (flag for later)
- Surveying staff on what they want on Production / Accounting dashboards. We're not changing those in this pass.
- Deleting `ManagerView.tsx` (kept in repo in case you reintroduce a manager role).
- A consolidated Reports → Dashboard pinning system.

### Open question
The plan removes `manager` from the role-preview selector. If you'd like to **keep** "Manager" as a preview-only lens for Admin (so you can see the leaner manager view sometimes), say so and I'll keep it as a fourth option restricted to admins.
