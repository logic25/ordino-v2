## Admin Dashboard — Round 3 Cleanup

### 1. Upcoming Billing Pipeline (fix empty state)
Change `useBillingPipeline.ts` from "status = billed" to **services on active projects with `estimated_bill_date` set, not fully billed**:
- `services.status IN ('in_progress','billed')`
- `billed_amount < total_amount` (or `fixed_price` if no total)
- `estimated_bill_date IS NOT NULL`
- `projects.status = 'active'` and not closed
- Exclude services already inside a pending/approved `billing_requests`
- Sort by `estimated_bill_date` ASC, default show next 60 days; "Show all" toggle
- Add `InfoTooltip` on the card title explaining the rule

### 2. Sales Health absorbs Cycle Times
- Add to `SalesHealthCard`: "Avg proposal sign time (Xd)" and "Avg invoice payment time (Yd)" as a small footer row under the win-rate panel
- Delete `CycleTimesCard.tsx` and remove `"cycle-times"` from layout defaults + `ROLE_WIDGETS.admin`

### 3. Remove Collected vs Billed card
- Drop `CollectedVsBilledCard` from admin dashboard widget map + role defaults (kept inside `BillingReports`/`AccountingView` where collection rate already lives)
- Delete `CollectedVsBilledCard.tsx`

### 4. Merge Stale Projects (total + by-PM)
- New unified `StaleProjectsCard`: header shows total count pill; body lists PM rows with their stale count as a click-pill
- Clicking the total pill OR any PM pill opens `StaleProjectsModal` with the project list (project #, name, PM, days since activity, link) — styled like the legacy Change Orders modal screenshot
- Remove `StaleProjectsByPM` widget id from layout

### 5. Active Proposals KPI — momentum
In `KpiStrip` (`AdminCompanyView`):
- Primary: count of proposals **created** this calendar month
- Delta vs prior month (▲/▼ N, color-coded), value shown as secondary subtitle
- Tooltip: "Proposals created this month vs last month"

### 6. Click-through modals for count pills (legacy-style)
Create reusable `<DrillInModal title count>` (Dialog wrapper matching the Change Orders modal layout: summary header strip + scrollable list). Wire into:
- Stale Projects total + per-PM pills → project list
- Proposal Follow-Ups card count → follow-up rows
- KPI strip pills (Active Projects, Active Proposals, AR Outstanding) → underlying list (projects / proposals / invoices)

### 7. Billing Pulse tooltip
Add `InfoTooltip` next to "Billing Pulse" title explaining: MTD billed vs collected, current AR aging buckets, % of monthly goal. (Card already exists; just add tooltip wiring.)

### 8. My View button polish
In `AdminCompanyView`:
- Render as segmented control "Company | My View" using `Tabs` styling, current view filled (`variant="default"`), other `variant="outline"`. Same toggle behavior, just visually obvious which is active.

### 9. Answer-only items (no code changes)
- **AI summary cron frequency:** project summaries are **event-driven** (regenerated immediately when an action item, note, checklist item, or status change is inserted via `enqueue_project_summary` → `auto-summarize-projects`). The `weekly-project-digest` edge function additionally sweeps every open project **once a week** as a safety net. Will surface this in a small "Last refreshed: Xh ago" line on the project detail summary card (out of scope here — flagging for next round).

### Files
**Edit:** `useBillingPipeline.ts`, `AdminCompanyView.tsx`, `SalesHealthCard.tsx`, `useDashboardData.ts` (add cycle-time aggregates to sales-health query, proposals-this-month vs last-month, stale projects with PM breakdown), `useDashboardLayout.ts` (remove cycle-times, collected-vs-billed, stale-projects-by-pm ids from defaults), `StaleProjectsCard.tsx`, `BillingPulse.tsx`, `ProposalFollowUps.tsx`, `KpiStrip` block in `AdminCompanyView.tsx`.
**New:** `DrillInModal.tsx` (shared), `StaleProjectsModal.tsx`.
**Delete:** `CycleTimesCard.tsx`, `CollectedVsBilledCard.tsx`, `StaleProjectsByPM.tsx`.
**Changelog:** insert `changelog_entries` row summarising dashboard v3.

### Out of scope
- Project-detail "last AI refresh" timestamp UI
- Per-project AI summary frequency knob
- Pixel-resize widgets (react-grid-layout)
