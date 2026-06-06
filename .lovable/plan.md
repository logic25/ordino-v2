## Production dashboard — smarter KPI strip + untouched-projects bucket

### 1. Replace the 4 Production KPI cards
File: `src/components/dashboard/DashboardStats.tsx` (PM/Production branch only — Admin and Accounting unaffected).

New cards, left → right:

| # | Title | Value | Subtitle | Click |
|---|---|---|---|---|
| 1 | **Hours Today** | sum of today's `time_log_activities.duration_minutes` for me, formatted `h:mm` | "Keep logging" | `/time` |
| 2 | **On You** | count of my open projects with `waiting_on = 'us'` AND `updated_at` ≥ 7 days ago | "Idle 7+ days — your move" | scrolls to On-You bucket |
| 3 | **Waiting on Client** | count of my open projects with `waiting_on = 'client'` AND `waiting_since` ≥ 14 days ago | "14+ days — time to nudge" | scrolls to Waiting-on-Client bucket |
| 4 | **Project Readiness <50%** | count of my open projects where checklist completion < 50% | shows lowest-% project name, e.g. "Lowest: PIS 7 (20%)" | scrolls to Project Readiness card |

All four are derived from data the dashboard already fetches (`useMyAssignedProjects`, `useMyProjectReadiness`, `useDashboardStats.todayHours`) — no new endpoints needed. Add a small `useProductionKpis` helper in `src/hooks/useDashboard.ts` that composes them so the cards render in one render pass.

Cards use:
- destructive accent when value > 0 for "On You"
- amber accent when value > 0 for "Waiting on Client" and "Readiness <50%"
- neutral for "Hours Today"

### 2. Add "Hasn't been touched" bucket to My Projects (`PMDailyView.tsx`)
- New hook `useMyUntouchedProjects` — open projects assigned to me with **zero** rows in `time_log_activities` AND no `updated_at` newer than `created_at + 1 day`.
- Render bucket at the top of the "My Projects" card with an amber header `"Hasn't been touched — kick these off"`.
- Remove the `.slice(0, 8)` cap on "Recently Active" and sort it **oldest `updated_at` first**.

### 3. Cleanup
- Drop the now-unused "My Projects (count)" and "Team Members" entries from the production layout defaults in `useDashboardLayout.ts`.
- Add anchors (`id="bucket-on-you"`, etc.) on the bucket headers in `PMDailyView` so the KPI cards can `scrollIntoView` on click.

### 4. Changelog
Insert one `changelog_entries` row: "Production dashboard upgraded — KPI cards now show On You / Waiting on Client / Readiness gaps, and a new 'Hasn't been touched' bucket surfaces neglected projects."

### Files touched
- `src/components/dashboard/DashboardStats.tsx`
- `src/components/dashboard/PMDailyView.tsx`
- `src/hooks/useDashboard.ts`
- `src/hooks/useDashboardLayout.ts`

### Out of scope
- Admin and Accounting dashboards (untouched).
- Role-preview selector, role renaming.
- New tasks/proposals widgets.
- DB migrations (none required).
