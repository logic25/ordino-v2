

# Make All Dashboard KPI Cards Clickable

## Problem
The four KPI stat cards at the top of the Admin dashboard ("Active Projects", "Team Members", "Outstanding", "Overdue Invoices") are static display cards. Clicking them does nothing.

## Solution
Add click navigation to each KPI card so it takes you to the relevant page:

| Card | Navigates To |
|------|-------------|
| Active Projects | `/projects` |
| Team Members | `/settings?section=team` |
| Outstanding (dollar amount) | `/billing` (Invoices page) |
| Overdue Invoices | `/billing` (Invoices page) |

Also apply this pattern to the **PM view's DashboardStats** cards (Hours Today, My Projects, Pending Proposals, Team Members) with appropriate destinations:

| Card | Navigates To |
|------|-------------|
| Hours Today | `/time` |
| My Projects | `/projects` |
| Pending Proposals | `/proposals` |
| Team Members | `/settings?section=team` |

## Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/AdminCompanyView.tsx` | Add `useNavigate`, add `href` field to each KPI, wrap each card with `onClick` + `cursor-pointer hover:shadow-md` styling |
| `src/components/dashboard/DashboardStats.tsx` | Add `useNavigate`, add `href` to each stat, pass to `StatCard`, add `onClick` + hover styling |

## Visual Treatment
- Add `cursor-pointer` and `hover:shadow-md transition-shadow` to each card
- No layout changes -- just interactive feedback on hover/click
