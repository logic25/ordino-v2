

# Automated Bug Triage & Fix Tracking System

## Overview

This system adds AI-powered auto-triage to incoming bug reports, a fix tracking/audit log, a dashboard for bug metrics, weekly email reports, and a pattern-learning system. Bugs are stored in the existing `feature_requests` table (with `category = 'bug_report'`).

---

## Technical Details

### Existing Architecture
- Bugs live in `feature_requests` table with `category = 'bug_report'`
- Comments in `bug_comments`, activity in `bug_activity_logs`
- Email alerts via `send-bug-alert` edge function
- `LOVABLE_API_KEY` is available for AI calls

---

## Phase 1: Auto-Triage on Bug Submission

### Database Changes (Migration)

**Add columns to `feature_requests`:**
- `ai_severity` (text, nullable)
- `ai_diagnosis` (text, nullable)
- `ai_suggested_files` (jsonb, nullable)
- `ai_triaged_at` (timestamptz, nullable)
- `fixed_by` (text, nullable) — "claude_code", "lovable", "manual"
- `fix_description` (text, nullable)
- `files_changed` (jsonb, nullable)
- `fix_verified_at` (timestamptz, nullable)
- `resolution_time_hours` (numeric, nullable)

**Create `bug_patterns` table:**
- `id` (uuid PK), `company_id` (uuid FK), `pattern_name` (text), `affected_files` (jsonb), `root_cause` (text), `fix_pattern` (text), `occurrences` (int default 1), `last_seen` (timestamptz), `created_at` (timestamptz)

**Create `bug_fix_log` table:**
- `id` (uuid PK), `bug_report_id` (uuid FK → feature_requests), `company_id` (uuid), `diagnosis` (text), `fix_description` (text), `files_changed` (jsonb), `fixed_by` (text), `submitted_at` (timestamptz), `fixed_at` (timestamptz), `verified_at` (timestamptz), `was_first_attempt` (boolean), `rejection_notes` (text), `created_at` (timestamptz)

RLS: company-scoped read for authenticated users, service-role writes.

### New Edge Function: `triage-bug-report`

- Accepts `{ bug_id }` or can be triggered from the `send-bug-alert` function after a new bug is inserted
- Reads the bug from `feature_requests` (page, action, expected, actual, screenshots, loom_url)
- Hardcoded page-to-file mapping (Properties → PropertyDetail, useBuildingLookup; Projects → ProjectDetail, ServicesFull; RFPs → RfpBuilderDialog, useRfps; Email → EmailInbox, useEmails; etc.)
- Queries `bug_patterns` for similar patterns (matching page + keywords)
- Calls Lovable AI (Gemini Flash) with a structured prompt asking for: severity, root cause, suggested files, fix complexity
- Uses tool-calling to extract structured JSON response
- Posts an auto-comment to `bug_comments` with the formatted diagnosis
- Updates `feature_requests` with `ai_severity`, `ai_diagnosis`, `ai_suggested_files`, `ai_triaged_at`
- If a pattern match is found, includes "Known pattern" note in the comment

### Integration Point
- After `submitBug` succeeds in `BugReports.tsx`, the existing `send-bug-alert` call already fires. We'll add a call to `triage-bug-report` right after (or chain it from `send-bug-alert`).

---

## Phase 2: Fix Tracking & Dashboard

### UI Changes

**BugReports.tsx — Status save enhancements:**
- When status changes to "resolved", show fields for: `fixed_by` (dropdown: Claude Code / Lovable / Manual), `fix_description` (textarea), `files_changed` (text input, comma-separated)
- On save, insert into `bug_fix_log` and update the `feature_requests` columns
- Calculate `resolution_time_hours` from `created_at` to `resolved_at`
- Track `was_first_attempt` (true if bug was never reopened/rejected)

**New component: `BugFixDashboard.tsx`**
- Added as a sub-tab or section within the Bug Reports tab (admin-only)
- Cards: Bugs fixed this week/month, avg fix time, fix success rate, most common categories
- Table: Most frequently broken files (aggregated from `ai_suggested_files` and `files_changed`)
- Chart: Bugs submitted vs resolved over time (using Recharts, already in project)

### Bug Detail Sheet Enhancement
- Show AI triage card (severity badge, diagnosis, suggested files) when `ai_diagnosis` exists
- Show fix log history from `bug_fix_log`

---

## Phase 3: Weekly Email Report

### Scheduled Edge Function: `weekly-bug-report`

- Triggered via pg_cron every Monday at 9 AM EST
- Queries `feature_requests` for bugs submitted/resolved in the past 7 days
- Aggregates: total submitted, total fixed, still open, avg resolution time, top 3 by severity
- Aggregates `files_changed` across all resolved bugs for the week
- Uses AI to detect patterns (e.g., "3 bugs in email module")
- Sends via `gmail-send` to admin users (queries `user_roles` for admins, gets their email from `gmail_connections`)
- Branded HTML email matching existing template style

---

## Phase 4: Bug Pattern Learning

### Auto-pattern creation
- When a bug is resolved, the `triage-bug-report` function (or a separate trigger) checks if a similar pattern already exists in `bug_patterns` (matching `affected_files` overlap + similar root cause)
- If match: increment `occurrences`, update `last_seen`
- If no match: insert new pattern from the resolved bug's diagnosis data

### Pattern matching on new bugs
- During auto-triage, query `bug_patterns` for entries with overlapping page/file references
- If a match confidence is high, append "Known pattern" section to the diagnosis comment

---

## Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Add columns to `feature_requests`, create `bug_patterns` and `bug_fix_log` tables |
| `supabase/functions/triage-bug-report/index.ts` | New — AI triage edge function |
| `supabase/functions/weekly-bug-report/index.ts` | New — Monday 9 AM email report |
| `supabase/config.toml` | Add `triage-bug-report` and `weekly-bug-report` entries |
| `src/components/helpdesk/BugReports.tsx` | Add fix tracking fields on resolve, show AI triage card, trigger triage |
| `src/components/helpdesk/BugFixDashboard.tsx` | New — metrics dashboard component |
| `src/pages/HelpDesk.tsx` | Wire in dashboard (admin-only section in Bug Reports tab) |
| pg_cron SQL (insert tool) | Schedule `weekly-bug-report` every Monday 9 AM |

---

## Implementation Order

1. Database migration (new columns + tables)
2. `triage-bug-report` edge function + deploy
3. Update `BugReports.tsx` — trigger triage on submit, show AI diagnosis, add fix tracking fields
4. `BugFixDashboard.tsx` — metrics dashboard
5. `weekly-bug-report` edge function + pg_cron schedule + deploy
6. Pattern learning logic (within triage function)

