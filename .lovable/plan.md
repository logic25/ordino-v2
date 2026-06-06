# Fix: Attendance sessions never clock out

## What's actually broken

Confirmed in the database — this is a real bug, not a display glitch:

- **Manny:** 14+ open sessions going back to early May (every day you logged in and never clicked Clock Out).
- **Natalia & Sheri:** several open sessions each.
- The oldest dangling clock-in is from **May 8, 2026** — almost a month "clocked in."

## Why it's happening

Two failures combine:

1. **No auto-close cron exists.** The Help Center copy at `src/components/helpdesk/HowToGuides.tsx:219` literally tells users *"Sessions left open past midnight are auto-closed and flagged for review."* — but there's no edge function or `pg_cron` job that does it. `auto_closed` is always `false` in the DB.
2. **Auto clock-in on every login** (`useAutoClockIn` in `src/hooks/useAttendance.ts:167`) creates a new row each day, but most users never click Clock Out. The unique constraint silently swallows duplicate same-day attempts (`error.code === "23505"` → `return null`), so nothing visibly breaks until you look at the attendance table and see weeks of open sessions.

## The fix (three parts)

### 1. Backfill — close every dangling session
For every `attendance_logs` row where `clock_out IS NULL` AND `log_date < today`:
- Set `clock_out` = `log_date` at 23:59:59 in the company timezone (fallback America/New_York since this is NYC-focused).
- Set `auto_closed = true`.
- Compute `total_minutes` from clock_in → clock_out, **capped at 600 minutes (10 hrs)** so a month-old open session doesn't show as 700 billable hours.
- Add a note: `"Auto-closed by system backfill — original clock-out missing"`.

Today's still-open rows are left alone (you're actually clocked in right now).

### 2. Nightly auto-close cron
New edge function `auto-close-attendance` + `pg_cron` schedule that runs every day at **05:00 UTC** (≈ 1 AM ET, after midnight in all US timezones):
- Finds rows where `clock_out IS NULL` AND `log_date < CURRENT_DATE`.
- Sets `clock_out` to end of `log_date`, `auto_closed = true`, `total_minutes` computed and capped at 600.
- Logs a row to `automation_logs` for visibility.
- Uses the `x-cron-secret` pattern per the project's automation-auth rules.

### 3. Surface auto-closed sessions in the UI
`AttendanceTable.tsx` already has an `auto_closed` branch (line 91) — promote it visually:
- Show an amber "Auto-closed" pill instead of the time in the Clock Out column.
- Add a small "Fix" button on auto-closed rows that opens the existing manual-edit flow (mandatory reason per the time-tracking audit-trail rule) so the user can correct the real clock-out time. This keeps the audit trail clean.

## Optional polish (ask before doing)

- **Prevent the re-occurrence at clock-in time:** when `useClockIn` runs and finds yesterday's row still open for that user, auto-close it first (same logic as the cron, but inline). Catches drift between nightly runs.
- **Daily summary email to admins** listing yesterday's auto-closed sessions so out-of-office / forgotten logouts are visible the next morning. Reuses the existing notification pipeline.

## Files touched

- New: `supabase/functions/auto-close-attendance/index.ts`
- Migration: `pg_cron` schedule + one-time backfill UPDATE
- Edit: `src/components/time/AttendanceTable.tsx` — auto-closed pill + Fix button
- Edit: `src/hooks/useAttendance.ts` — optional pre-clock-in cleanup
- Changelog: insert one `changelog_entries` row (fix type) per project policy

## What this does NOT change

- Doesn't touch project-level time logs (those are separate from attendance).
- Doesn't change the auto-clock-in-on-login behavior — that's intentional per the time-tracking system memory.
- No schema changes beyond the cron schedule.
