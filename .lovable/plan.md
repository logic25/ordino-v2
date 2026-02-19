

# Enhanced Reports: Missing Report Types and Improvements

## What's Happening Now

The Operations tab shows empty cards because the database has no completed service records or client revenue data yet. The Service Duration Analytics section is correctly hidden when there's no data, but the remaining cards ("Top Clients by Revenue", "Team Workload") also show "No data" because no projects have been assigned to PMs or invoices paid. The other tabs (Projects, Billing, Time, Proposals) similarly depend on having real data.

## What's Missing (Inspired by Reference Dashboard)

Looking at your reference screenshot and comparing to what Ordino currently has, here are the gaps:

### 1. Company-Wide KPI Summary Bar (New -- Top of Reports Page)
A row of headline KPI cards visible above all tabs, showing at-a-glance numbers:
- **# Pending Proposals** and **$ Pending Proposals**
- **# Open Invoices** and **$ Open Invoices**
- **Active Projects** count
- **YTD Revenue Collected**

These pull from existing data (proposals, invoices, projects) and always show something even if some values are zero.

### 2. Active Jobs by PM (Operations Tab)
A **stacked horizontal bar chart** showing each PM's active project count, broken down by service type (color-coded). This is more useful than just "X active" because it shows the mix -- a PM with 40 Pull Permits looks very different from one with 10 Alt-1s.

### 3. Active Jobs by Status (Projects Tab)
A **vertical bar chart** showing project count per status (Active, Pending, Closed, On Hold, etc.). The existing pie chart shows this but a bar chart matches the reference and is easier to read with many categories.

### 4. Revenue by Service Type (Billing Tab)
A **donut chart** showing total billed or collected revenue broken down by service type (e.g., "Pull Permit: $45K, Alt-2: $120K, CO: $200K"). Shows what service lines generate the most money.

### 5. YTD Sales by Sales Rep (Proposals Tab)
A **bar chart** showing each sales person's year-to-date proposal value (executed proposals). Identifies top performers.

### 6. Better Empty States
Instead of just "No data", show helpful context like "Revenue will appear here as invoices are created and paid" with an icon. Makes the reports page feel intentional even before data flows in.

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `src/pages/Reports.tsx` | Add KPI summary bar above tabs |
| `src/components/reports/OperationsReports.tsx` | Add "Active Jobs by PM" stacked bar chart |
| `src/components/reports/ProjectReports.tsx` | Add "Active Jobs by Status" bar chart alongside existing pie |
| `src/components/reports/BillingReports.tsx` | Add "Revenue by Service Type" donut chart |
| `src/components/reports/ProposalReports.tsx` | Add "YTD Sales by Rep" bar chart |
| `src/hooks/useReports.ts` | Extend existing hooks to return additional breakdowns (service-type revenue, PM job mix, sales rep totals) |

### New Data Queries

**KPI Summary (Reports.tsx)**: Simple counts from proposals (status in draft/sent), invoices (status in sent/overdue), and projects (status = active). All use existing tables.

**Active Jobs by PM**: Query `projects` joined with `services` and `profiles` to get each PM's active service breakdown. Group by `assigned_to` then by `service.name`.

**Revenue by Service Type**: Query `invoices` joined to `projects` and `services` to attribute invoice amounts to service types. Uses existing foreign keys.

**YTD Sales by Rep**: Query `proposals` where status = executed and created_at is current year, grouped by `sales_person_id`, joined to `profiles` for display names.

### Implementation Order
1. Add KPI summary bar to Reports page (always visible, above tabs)
2. Improve empty states across all report tabs
3. Add Active Jobs by PM stacked chart to Operations
4. Add Revenue by Service Type donut to Billing
5. Add YTD Sales by Rep chart to Proposals
6. Add Active Jobs by Status bar chart to Projects

