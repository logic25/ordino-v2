

# Redesign the Monthly Open Services Report Email

## Problem
The current "Open Services Report" email sent on the 1st of each month is a flat table dump of all open services with no summary, no grouping by PM, no totals, and no goal-tracking context. Chris wants:
1. **Summary header** -- total number of open services and their total dollar value
2. **Grouped by PM** -- services organized under each Project Manager
3. **Two versions** -- individual PM version (just their services) + admin/leadership version (full team)
4. **Goal nudge/applause** -- compare each PM's open service value to their `monthly_goal` and include encouraging or motivating language

## Solution

### 1. Create new edge function: `send-open-services-report`

A new Supabase Edge Function that:
- Queries all services with status `not_started` or `in_progress` (the "open" services expected to be completed this month)
- Joins with `projects` (for project number, address, name, assigned_pm_id) and `profiles` (for PM name, email, monthly_goal)
- Groups services by PM
- For each PM, calculates:
  - Total service count
  - Total dollar value (sum of `fixed_price` or `total_amount`)
  - Comparison to `monthly_goal` -- percentage of goal, with motivational messaging
- Sends **two types of emails** via the existing `gmail-send` function:
  - **PM email**: just that PM's services with their goal progress
  - **Admin email** (to Chris and Manny): full team breakdown with all PMs, totals, and goal comparisons

### 2. Email template design

**Subject**: `Monthly Open Services Report -- March 2026`

**Header section**:
- Total open services: XX
- Total value: $XX,XXX.XX

**Per-PM section** (repeated for each PM):
- PM Name
- Monthly Goal: $XX,XXX | Open Services Value: $XX,XXX | Progress: XX%
- Motivational badge: "On track", "Keep pushing", "Needs attention" based on thresholds
- Table of their services: Project#, Address, Service, Amount, Status

**Footer**: link to the app's Reports page

### 3. Goal comparison logic

| Open Value vs Goal | Message |
|----|-----|
| >= 100% | "Fully loaded -- great pipeline this month!" |
| 70-99% | "On track -- solid workload ahead" |
| 40-69% | "Room to grow -- consider picking up capacity" |
| < 40% | "Light month -- check with leadership on upcoming assignments" |

### 4. Admin recipients

Query profiles with role `admin` or `manager` to get leadership email addresses. Each admin gets the full-team version.

### 5. Scheduling

This function will be designed to be called via a cron job or manual trigger on the 1st of each month. It can also be invoked manually from the app if needed.

---

## Technical Details

### Files to create
- `supabase/functions/send-open-services-report/index.ts` -- the edge function

### Files to modify
- None required for the core email. Optionally, a "Send Report Now" button could be added to the Reports page later.

### Edge function logic (pseudocode)

```text
1. Query services WHERE status IN ('not_started', 'in_progress')
2. Join projects (project_number, name, address, assigned_pm_id, status='open')
3. Join profiles for PM info (name, email, monthly_goal)
4. Group by PM
5. For each PM:
   a. Calculate totalServices, totalValue
   b. Compare totalValue to monthly_goal
   c. Pick motivational message
6. Build PM-specific HTML email, send via gmail-send
7. Build admin/team HTML email with all PMs, send to admins
8. Return summary of emails sent
```

### Data flow
- Uses existing `gmail-send` edge function for delivery
- Uses existing `profiles.monthly_goal` field for goal comparison
- Queries `services`, `projects`, `profiles` tables (all have RLS but function uses service role key)

