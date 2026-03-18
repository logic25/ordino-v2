

## Problem

The global KPI cards (Pending Proposals, Open Invoices, Active Projects, YTD Collected) sit above the tabs and persist across all tab changes. They aren't contextual to the selected report, which feels disorienting — users expect the content to change when they switch tabs.

## Proposed fix

**Move the KPI summary inside the Projects tab** instead of sitting above all tabs. Each report tab already has its own summary cards (e.g., Billing has revenue/aging, Proposals has win rate, SignalReports has subscription counts). The global KPIs are most relevant to the Projects overview, so they belong there.

### Changes

**`src/pages/Reports.tsx`**
- Remove the `ReportsKPISummary` rendering from above the `<Tabs>` component.
- Remove the `activeTab` state (no longer needed for conditional rendering).
- Remove the `ReportsKPISummary` import.

**`src/components/reports/ProjectReports.tsx`**
- Import and render `ReportsKPISummary` at the top of the Projects tab content, so those KPIs appear only when viewing Project reports.

This way every tab shows only its own relevant metrics — no persistent cards that feel out of place.

