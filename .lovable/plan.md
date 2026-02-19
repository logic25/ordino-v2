

# Service Duration Analytics

## What This Adds

A new "Service Performance" report tab (or section within the Operations tab) that shows how long each type of service takes from creation to completion, with robust statistics beyond just averages.

## Why Average Alone Is Not Enough

A single average is misleading when outliers exist. If 9 "Pull Permits" take 5 days but one takes 90 days (stalled, waiting on client), the average shows 13.5 days -- not representative. The system should show:

- **Median**: The "typical" duration (50th percentile), not skewed by outliers
- **P75 and P90**: How long the slow cases take -- useful for setting client expectations
- **Min / Max**: Fastest and slowest instance
- **Volume**: How many of each service type have been completed (low sample sizes get flagged)
- **Trend**: Monthly average duration plotted over time to see if the team is getting faster or slower
- **By PM**: Which PMs complete which services faster (identifies coaching opportunities and best practices)

## Data Source

The `services` table already has:
- `name` (service type, e.g., "ALT-2", "Pull Permit", "CO")
- `created_at` (when service was added to the project)
- `completed_date` (when marked complete)
- `status` (not_started, in_progress, complete, billed, paid)
- `project_id` (to join to projects for PM assignment)

Duration = `completed_date - created_at` in days, filtered to services with status in (complete, billed, paid).

## What Gets Built

### 1. Service Duration Summary Table

A table with one row per service type showing:

| Service Type | Completed | Median Days | Avg Days | P75 | P90 | Fastest | Slowest |
|---|---|---|---|---|---|---|---|
| Pull Permit | 45 | 5 | 7.2 | 8 | 14 | 2 | 42 |
| ALT-2 | 28 | 18 | 22.1 | 28 | 35 | 8 | 60 |
| CO | 12 | 45 | 52.3 | 62 | 78 | 22 | 95 |

Services with fewer than 3 completed instances show a "Low sample" badge.

### 2. Duration Trend Chart

A line chart showing monthly median duration per service type (filterable by service). Shows whether the team is getting faster or slower over the last 12 months.

### 3. PM Comparison View

A grouped bar chart or table showing median duration by PM for each service type. Highlights outliers (PMs significantly above the company median for a service type).

### 4. Active Services "Time in Progress"

For services currently in progress (not yet completed), show how many days they've been open. Flag services exceeding the P75 duration for their type as "at risk of delay."

## Technical Details

### New Hook: `useServiceDurationReports`

Queries the `services` table for all completed services, joins to `projects` for PM info. Calculates percentiles client-side (data volume should be manageable). Returns:
- Per-service-type stats (median, avg, P25/P75/P90, min, max, count)
- Monthly trend data
- Per-PM breakdown
- Active services with days-open and risk flags

### Files

| File | Change |
|------|--------|
| `src/hooks/useReports.ts` | Add `useServiceDurationReports` hook |
| `src/components/reports/OperationsReports.tsx` | Add Service Duration section with summary table, trend chart, PM comparison, and at-risk list |

### Percentile Calculation (Client-Side)

```text
function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const frac = idx - lower;
  return sorted[lower] + frac * ((sorted[lower + 1] ?? sorted[lower]) - sorted[lower]);
}
```

### Implementation Order
1. Add `useServiceDurationReports` hook to `useReports.ts`
2. Build the service duration summary table in OperationsReports
3. Add the duration trend line chart
4. Add PM comparison view
5. Add active services "at risk" section
