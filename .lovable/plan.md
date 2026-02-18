
# Admin Dashboard Enhancement + Additional Reports

## 1. Admin Dashboard -- Revenue Trend Fix and New Widgets

### Revenue Trend Chart -- Make it Bigger and Better
- Increase chart height from 280px to 360px so it fills the card properly
- Give it the full width of the row (remove the sidebar column with ProposalFollowUps/TeamOverview from being side-by-side with it)
- Restructure the layout: Revenue Trend takes full width as its own row, then below it a 3-column grid with ProposalFollowUps, Year-over-Year Comparison, and Activity Summary

### Year-over-Year Comparison Chart (new)
- A line or grouped bar chart comparing the current period's revenue against the same period last year
- Uses the same invoice data, just sliced into two ranges: current year vs. previous year
- Monthly bars side-by-side labeled "2025" and "2026" (or whichever years apply)
- Placed in the second row alongside the other cards

### Proposal Activity Card (new)
- A compact card showing:
  - Number of proposals created this month vs. last month
  - Arrow up/down indicator with percentage change
  - Total value of proposals this month vs. last month
  - Simple "Proposals are up 23% this month" or "down 12%" message
- Uses proposals table, comparing `created_at` month ranges

### Layout Restructure
```text
Row 1: [KPI] [KPI] [KPI] [KPI]
Row 2: [Revenue Trend -- full width, taller chart with period selector]
Row 3: [YoY Comparison] [Proposal Activity Card] [Proposal Follow-Ups]
Row 4: [Team Overview]
```

## 2. Additional Reports (New Tabs and Enhancements)

### Referrals Tab (new report tab)
- **Top Referrers Table**: Rows for each unique `referred_by` value from proposals showing: referrer name, number of proposals, number converted, conversion rate, total value referred, converted value
- **Referral Source Breakdown**: Pie chart by `lead_source` field
- **Year filter** to scope data
- Hook: `useReferralReports` querying proposals grouped by `referred_by` and `lead_source`

### Data Exports Tab (new report tab)
- Grid of export cards: Projects, Clients, Invoices, Proposals, Time Entries, Contacts
- Each card has a "Download CSV" button that fetches data and generates a CSV file client-side
- Summary stats at the top: total projects, total invoices value, total collected

### Enhancements to Existing Reports

**Projects Tab -- add:**
- Projects created per month trend (bar chart, last 12 months)
- Average project duration (from created to closed)

**Billing Tab -- add:**
- Revenue collected vs. billed comparison (already exists but ensure it uses correct columns)
- Top 10 clients by outstanding balance (horizontal bar)

**Time Tab -- add:**
- Weekly hours trend chart (last 8 weeks)
- Billable vs. non-billable split as a donut chart

**Operations Tab -- add:**
- Project completion rate trend (monthly)
- Stalled projects list (no activity in 30+ days)

## Technical Details

### Files Modified

| File | Changes |
|------|---------|
| `src/components/dashboard/AdminCompanyView.tsx` | Restructure layout: full-width revenue trend, add YoY chart and proposal activity card |
| `src/hooks/useDashboardData.ts` | Add `useYearOverYearRevenue` and `useProposalActivity` hooks |
| `src/pages/Reports.tsx` | Add "Referrals" and "Exports" tabs |
| `src/hooks/useReports.ts` | Add `useReferralReports` hook |
| `src/components/reports/ProjectReports.tsx` | Add monthly creation trend and avg duration |
| `src/components/reports/BillingReports.tsx` | Add top clients by outstanding |
| `src/components/reports/TimeReports.tsx` | Add weekly trend and billable donut |
| `src/components/reports/OperationsReports.tsx` | Add completion rate trend and stalled projects |

### New Files

| File | Purpose |
|------|---------|
| `src/components/dashboard/ProposalActivityCard.tsx` | Month-over-month proposal activity with up/down indicator |
| `src/components/dashboard/YearOverYearChart.tsx` | Side-by-side yearly revenue comparison |
| `src/components/reports/ReferralReports.tsx` | Referral analytics with top referrers table and source pie chart |
| `src/components/reports/DataExports.tsx` | CSV export cards for all major data tables |

### Implementation Order
1. Restructure AdminCompanyView layout (full-width revenue trend, taller chart)
2. Build YearOverYearChart and ProposalActivityCard components with hooks
3. Create ReferralReports component and hook
4. Create DataExports component
5. Enhance existing report tabs (Projects, Billing, Time, Operations)
6. Add new tabs to Reports page
