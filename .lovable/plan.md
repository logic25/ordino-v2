
# Dashboard Overhaul + Sidebar Fix + Legacy Proposal Insights

## Problems to Fix

1. **Sidebar collapse button disappears** when collapsed -- the 16px width makes header content overflow/hidden
2. **Dashboard is generic** -- PMs see the same "Recent Projects" list as everyone else with no actionable guidance
3. **Reports Proposal tab is too basic** compared to the legacy system's rich conversion table, source charts, and yearly comparisons
4. **No way to preview other role dashboards** for testing/development

---

## 1. Sidebar Collapse Button Fix

When the sidebar collapses to `w-16`, the header row with logo + toggle still needs to be usable. The fix:
- Keep the collapse/expand button visible and centered when collapsed (hide the "Ordino" text, keep the O logo and toggle stacked or side-by-side in the 64px width)
- Ensure `w-16` (64px) gives enough room for the logo icon + toggle button
- The current code already hides the text when collapsed, but the `justify-between` layout might push the toggle off-screen; switching to `justify-center` with a `gap` when collapsed fixes this

**File**: `src/components/layout/AppSidebar.tsx`

---

## 2. Role-Based Dashboard Redesign

### PM Dashboard -- "My Day" Focus
Replace the generic "Recent Projects" with actionable sections:
- **Today's Priority Tasks**: Projects with upcoming deadlines, checklist items needing action, pending follow-ups -- grouped as "Today", "This Week", "Overdue"
- **Status Changes**: Recent project status transitions (e.g., "Application approved", "Objection received") from project activity
- **My Active Projects** (compact): Small cards showing project name, next milestone, and days since last activity
- **Quick Time Log**: Keep existing but make it functional (actually logs time)
- **Proposal Follow-Ups**: Keep existing, it's already useful

### Admin Dashboard -- Company Overview + PM Toggle
- **Top section**: Key company KPIs (revenue, active projects, team utilization, overdue invoices) as stat cards
- **Toggle button**: "My View" / "Company View" switch -- clicking "My View" shows the PM dashboard
- **Company View**: Revenue trend mini-chart, team workload distribution, proposal pipeline value, overdue aging summary
- **Recent Activity Feed**: Latest changes across the company (new proposals, status changes, invoices paid)

### Accounting Dashboard -- Billing Focus
- **Revenue KPIs**: Monthly revenue, collection rate, outstanding balance, avg days to pay
- **Aging Summary**: Visual bar showing 0-30, 31-60, 61-90, 90+ day buckets with dollar amounts
- **Unbilled Projects**: List of projects with unbilled hours, sorted by amount
- **Recent Payments**: Latest invoices paid with amounts

### Manager Dashboard
- **Team Performance**: Hours logged per team member this week, project counts
- **Project Health**: Projects at risk (overdue, stalled checklist)
- **Proposal Pipeline**: Value of pending proposals

### Role Preview (Dev/Testing)
- Add a small dropdown in the dashboard header (only visible to admin role) that lets you preview other role dashboards: "Viewing as: Admin / PM / Accounting / Manager"

---

## 3. Enhance Proposal Reports (Legacy Parity)

From the legacy system screenshot, add to the Proposals tab in Reports:

### Conversion Rates Table (new)
- Monthly rows showing: Proposals Count, Converted Count, Conversion Rate, Converted Value, Change Orders value, Converted Total, Proposals Total Value
- Filters: User (sales person), Year, Month
- Totals row at bottom
- Data source: `proposals` table with `created_at`, `status`, `total_amount`, `sales_person_id`

### Proposal Sources Pie Chart (new)
- Pie chart breaking down proposals by `lead_source` (Referral, Architect, Repeat Client, Website, etc.)
- Year filter

### Yearly Comparison Bar Chart (new)
- Multi-year overlay bar chart showing monthly proposal values
- Selectable years (e.g., 2024, 2025, 2026)
- X-axis: months, Y-axis: dollar value

### Proposal Statuses Pie Chart (enhance existing)
- Already exists but enhance with year filter and cleaner labels

---

## Technical Details

### Files Modified

| File | Changes |
|------|---------|
| `src/components/layout/AppSidebar.tsx` | Fix collapse button layout for `w-16` state |
| `src/pages/Dashboard.tsx` | Full rewrite with role-based views and admin toggle |
| `src/components/dashboard/DashboardStats.tsx` | Update stat cards per role with more relevant metrics |
| `src/components/dashboard/RecentProjects.tsx` | Make compact variant for PM view |
| `src/components/reports/ProposalReports.tsx` | Add conversion table, source chart, yearly comparison |
| `src/hooks/useReports.ts` | Extend `useProposalReports` with monthly breakdown, lead source data, yearly data |
| `src/hooks/useDashboard.ts` | Add queries for PM tasks, status changes, unbilled projects |

### New Files

| File | Purpose |
|------|---------|
| `src/components/dashboard/PMDailyView.tsx` | PM-specific dashboard with tasks/priorities/status changes |
| `src/components/dashboard/AdminCompanyView.tsx` | Admin company-wide metrics with mini-charts |
| `src/components/dashboard/AccountingView.tsx` | Accounting-focused billing dashboard |
| `src/components/dashboard/ManagerView.tsx` | Manager team performance view |
| `src/components/dashboard/RolePreviewSelector.tsx` | Admin-only dropdown to preview other role dashboards |
| `src/components/dashboard/RecentActivityFeed.tsx` | Company-wide activity feed for admin view |
| `src/components/dashboard/AgingSummaryChart.tsx` | Visual aging buckets for accounting view |

### Implementation Order
1. Fix sidebar collapse button (quick fix)
2. Build PM Daily View component (most impactful)
3. Build Admin Company View with role toggle
4. Build Accounting and Manager views
5. Add role preview selector
6. Enhance Proposal Reports with legacy parity features
