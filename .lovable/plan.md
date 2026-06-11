
# Billing Dashboard Unification + Role Tune-Up

## Part A — Role tune-up

**Migration**
1. Re-tag the 3 current `production` users as `pm`
2. Confirm Sai is `accounting`; add explicit read grants to `projects`, `proposals`, `properties`, `clients`, `services`, `dob_applications` so she can review context but not edit
3. Leave `manager`, `production`, `staff` defined in the enum — zero cost, ready when you grow
4. Expose all 6 roles in Settings → Team dropdown with one-line role descriptions

**Effective access matrix**

| Capability | admin | pm | accounting |
|---|---|---|---|
| Create/edit proposals, projects, properties, RFIs, services | ✓ | ✓ | – |
| View projects/proposals (read-only) | ✓ | ✓ | ✓ |
| Time logs (own) | ✓ | ✓ | ✓ |
| Invoices, payments, billing pipeline (all PMs) | ✓ | – | ✓ |
| Own BillingPulse (week/month vs goal) | ✓ | ✓ | ✓ |
| Company-wide BillingPulse + financial reports | ✓ | – | ✓ |
| Settings, role assignment, billing goals | ✓ | – | – |

## Part B — Billing dashboard unification

### Surface separation (each answers a different question)

| Surface | Question | Owns |
|---|---|---|
| **Dashboard** | "What should I do this week?" | BillingPulse (time-bounded, pace), Inbox snapshot, Needs Attention |
| **`/invoices`** | "Manage the invoice lifecycle" | 6 lifecycle cards, full table + tabs, **Analytics tab kept as-is** |
| **Reports → Billing** | "How are we doing historically?" | A/R aging, BillingPulse over any range, enriched per-line pipeline table |

No metric appears on two surfaces measuring the same thing.

### What gets built

**1. Company billing goals**
- New columns on `companies`: `weekly_billing_goal_override`, `monthly_billing_goal_override` (nullable, admin-only)
- Effective: `monthly = override ?? SUM(active PMs' monthly_goal)`, `weekly = override ?? monthly / 4.33`
- New Billing Goals section in Company Settings

**2. Per-user weekly goal**
- Add `profiles.weekly_goal` (nullable; defaults to `monthly_goal / 4.33`)
- Admin can edit in Settings → Team; user can edit own from dashboard

**3. `BillingPulse` component (new)**
Hero block. Three scopes:
- `scope: "company"` — admin/accounting view of all invoices
- `scope: "self-pm"` — PM view: invoices where project's `assigned_pm = me`
- `scope: "self-biller"` — Sai's view: invoices where `created_by = me` (her throughput)

Shows: This Week $invoiced / $goal · pace badge (green ≥100, amber 80–99, red <80) · This Month $invoiced / $goal · days left · projected month-end · 8-week sparkline · for Sai also "X of Y items in inbox cleared this week"

**4. Unified `RevenueTrendChart`** — replaces Revenue Trend + YoY
- Mode toggle: 3M / 6M / 12M / YoY
- Dotted goal-line overlay

**5. `BillingPipelineTable` (Sai's enriched table — new)**
Dense, sortable, filterable. Columns: PM · Project · Service · Status · Est. Bill Date · Amount · Source (AI/manual) · Action
Filters: PM, status, this week / next week / month / overdue-to-bill, AI vs manual
Footer: totals per filter · Row → Services tab · "Bill now" → create-invoice flow
Lives on: Reports → Billing (full), Accounting dashboard, Admin dashboard (collapsed)

**6. `/invoices` cleanup (minimal — operational page stays operational)**
- Rename first card **"Draft" → "Ready to Invoice"** (already mixes draft invoices + ready-to-send services)
- Leave the 6 lifecycle cards otherwise unchanged
- **Leave Analytics tab as-is** (promises kept, payment reliability, etc. — still useful)

**7. Sai's dashboard (action-first)**
- **My Billing Pulse** (self-biller scope) — her throughput vs goal
- **Inbox snapshot** — "12 items waiting · $9,675 · oldest 22 days" → deep-links to `/invoices?tab=to-invoice`
- **Needs my attention** — overdue collections, failed payments, disputes, payment promises due today
- **Company BillingPulse** (small) — what the team is doing

**8. PM dashboard**
- **My Billing Pulse** (self-pm scope) — what I produced vs my goal
- **My Billable Pipeline** (scoped table) — open services with `estimated_bill_date ≤ end-of-week`
- Tasks, action items as today

**9. Admin dashboard re-arrangement**

```text
┌─────────────────────────────────────────────┐
│  Company BillingPulse  (week + month + pace) │
├──────────────────────┬──────────────────────┤
│  Proposals Pipeline  │  Proposal Activity   │
├──────────────────────┴──────────────────────┤
│  RevenueTrendChart  (with goal line)        │
├─────────────────────────────────────────────┤
│  Billing Pipeline Table  (collapsed)        │
├──────────────────────┬──────────────────────┤
│  Team Utilization    │  Projects by PM      │
├──────────────────────┴──────────────────────┤
│  Expense Approvals · Follow-Ups · Team      │
└─────────────────────────────────────────────┘
```

Removed: top KPI strip, `AccountingSummaryStrip`, `YearOverYearChart`, `BillingGoalTracker`, `BillingSummary`

### Files

**New**
- `src/components/dashboard/BillingPulse.tsx`
- `src/components/dashboard/RevenueTrendChart.tsx`
- `src/components/billing/BillingPipelineTable.tsx`
- `src/hooks/useBillingPulse.ts`
- `src/hooks/useBillingPipeline.ts`
- `src/components/settings/BillingGoalsSection.tsx`

**Edited**
- `AdminCompanyView.tsx`, `AccountingView.tsx`, `PMDailyView.tsx`
- `BillingReports.tsx` (prepend BillingPulse + pipeline table)
- `CompanySettings.tsx`, `DashboardLayoutConfig.tsx`
- `InvoiceSummaryCards.tsx` (rename Draft → Ready to Invoice)
- Settings → Team UI (expose 6 roles + per-user weekly goal)

**Deleted**
- `BillingSummary.tsx`, `AccountingSummaryStrip.tsx`, `YearOverYearChart.tsx`, `BillingGoalTracker.tsx`

**Migrations**
1. Re-tag `production` → `pm`, explicit accounting reads, changelog
2. `companies` goal-override columns + `profiles.weekly_goal` + admin-only RLS, changelog

### Out of scope
- Dedicated dashboards for manager/production/staff
- Forecast modeling beyond linear run-rate
- "Lock the week" workflow
- Touching the Analytics tab on `/invoices`

### Approval
Reply **go** and I'll start with the role migration, then BillingPulse + the rest in order.
