## Goal
Tighten the Admin dashboard: merge widgets, fix the PM list, add tooltips everywhere, show goals on the Billing tab, surface project "touches", and let users reorder cards.

## Changes

### 1. Merge "Proposal Activity" into "Proposals & Billing"
The old `ProposalActivityCard` (a list of recently sent / signed / executed proposals) lives just below the KPI tiles today. Retire it and surface the same data as a new **Activity** tab inside the existing `Proposals & Billing` card, alongside the Conversion and Billing tabs.

- Tab shows: latest sent, signed, executed proposals for the selected year, with date, client, amount, and a link into the proposal.
- Remove `<ProposalActivityCard />` from `AdminCompanyView.tsx` (it currently renders twice via the `yoy-proposals-followups` flag — both invocations go away).

### 2. Projects by PM — only real PMs
Currently lists every active profile (that's why Sai appears). Change `useProjectsByPM` to only return users who **either**:
- have role `pm`, `senior_pm`, or `admin`, **or**
- are assigned as PM on ≥1 open project.

Drop zero-count non-PMs. Sort by open-project count desc.

### 3. Tooltips on every dashboard card
Add a small `(i)` icon next to each card title with a hover tooltip explaining what it shows, the time window, and how the number is calculated. Coverage: Billing Pulse, Proposals Pipeline, Proposals & Billing (per tab), Revenue Trend, Upcoming Billing Pipeline, KPIs (each tile), Team Utilization, Projects by PM, Proposal Follow-Ups, Expense Approvals, Team Overview, Stale Projects (new).

### 4. Team Utilization — clarify labels
Keep the chart, sharpen the framing:
- Subtitle: "Billable hours logged vs total hours logged · Mon–Sun"
- Tooltip: **Billable** = activities flagged billable in the last 7 days; **Total** = all logged activities; **% Billable** = billable ÷ total.

No formula change.

### 5. New widget: Stale Projects by PM ("touches")
Per-PM count of open projects with no recent activity. "Touched" = any of: time logged, note added, status changed, email sent, comment posted. Uses the existing project last-activity signal (same one the Projects → Stale tab uses).

Buckets per PM, threshold pulled from settings (see §6):
- 0–7 days (fresh)
- 8–`stale_threshold` days (warming)
- `stale_threshold`+ days (cold)

Clicking a bucket → `/projects?pm=<id>&stale=<bucket>`.

### 6. Configurable stale threshold (default 14d)
Add a "Stale project threshold (days)" setting under **Settings → Projects** (or Settings → Reports — flag in open questions). Defaults to 14. Stored on `companies` as a new `stale_project_days` column. Used by:
- The Projects → Stale tab
- The new Stale Projects by PM widget

### 7. Billing by User — add goals
Pull each user's monthly billing goal from the existing `billing_goals` source (already used by `BillingPulse`). Add to the Billing tab:
- **Goal** column (monthly $)
- **vs Goal** column (% achieved, color-coded: red <50%, amber 50–90%, green ≥90%)
- Totals row aggregates goal and shows aggregate %.

### 8. User-arrangeable dashboard
Extend `useDashboardLayout`:
- Already stores per-role visibility in `profiles.notification_preferences.dashboard_layout`.
- Add an `order: string[]` array alongside visibility.
- Render widgets in saved order (fall back to default).
- Add an "Edit layout" toggle near the existing Customize button. In edit mode, a drag handle appears on each card. Use `@dnd-kit/sortable` (already in deps).
- "Reset layout" restores defaults.

### Not doing
- ~~Weekly breakdown tables like the screenshot ("Jun 1–7", "Jun 8–14")~~ — per your call, skipping.
- Editing billing goals from the dashboard (still in Settings → Billing Goals).
- Cross-role shared layouts (each user keeps their own arrangement).

## Files touched
- `src/hooks/useDashboardData.ts` — PM filter; billing-goal join; recent-proposals query for Activity tab; stale-projects-by-PM query
- `src/hooks/useDashboardLayout.ts` — add `order`, `setOrder`, `resetLayout`
- `src/components/dashboard/AdminCompanyView.tsx` — remove `ProposalActivityCard`, add `StaleProjectsByPM`, wire dnd-kit + edit mode, render in saved order, add info tooltips
- `src/components/dashboard/ProposalConversionTable.tsx` — add **Activity** tab, add **Goal / vs Goal** columns to Billing tab
- `src/components/dashboard/StaleProjectsByPM.tsx` (new)
- `src/components/dashboard/DashboardCardShell.tsx` (new) — small wrapper providing the info-tooltip slot and drag handle
- `src/components/settings/ProjectSettings.tsx` (or equivalent) — add "Stale project threshold" input
- `src/pages/Projects.tsx` — read threshold from company settings instead of hard-coded 14
- Migration: `companies.stale_project_days int default 14`
- Changelog entry

## Open question
**Where should the "Stale project threshold (days)" live in Settings — under Projects, Reports, or Company?** Default suggestion: **Settings → Projects** (next to other project-wide defaults).