# Project Notes + Weekly AI Project Summaries

## Problem
- The "Notes" tab on each project is mock UI — nothing saves, no real AI summary.
- The OOO handoff function exists but has no project-note context to pull from.
- No scheduled weekly "where does each open project stand?" digest.

## What we'll build

### 1. Real project notes (persistence)
- New `project_notes` table: `project_id`, `company_id`, `user_id`, `body`, `source` (`manual` | `ai_weekly` | `ai_on_demand`), `created_at`.
- RLS scoped to `company_id` via `is_company_member()`.
- Rewrite `NotesTab.tsx` to read/write from the table (replace mock `useState`).
- Show manual notes + AI summaries interleaved, newest first, with source badge.

### 2. On-demand AI project summary
- New edge function `summarize-project`: pulls the project's tasks, recent emails tagged to the project, time entries, checklist state, recent activity — feeds Gemini Flash for a 4–6 sentence "current state" summary.
- Stores result as a `project_notes` row with `source = 'ai_on_demand'`.
- Wire the existing "AI Summary" button in NotesTab to call it.

### 3. Weekly auto-summary for open projects
- New edge function `weekly-project-digest` (runs Monday 6am via pg_cron).
- For each project in `active` / `in_progress` status per company:
  - Calls the same summarization logic.
  - Writes a `project_notes` row with `source = 'ai_weekly'`.
- Sends one consolidated digest email per PM (their assigned open projects only) with the summaries inline.

### 4. Feed OOO handoff with notes
- Update `generate-ooo-handoff` to include the latest `project_notes` row (manual or AI) per project the user owns, so the covering teammate sees real context, not just task lists.

## Where Sheri would put project notes
On any project → **Notes tab**. She types into the textarea, clicks Save, it persists. She'll also see a fresh AI summary auto-appear every Monday and can hit "Generate Summary" anytime.

## Out of scope (separate asks)
- Migrating old Ordino notes in (do after stable).
- Slack/Chat delivery of the weekly digest (email only for v1).

## Technical notes
- Reuse Gemini 2.5 Flash via Lovable AI Gateway (no new key).
- Use `pg_cron` + edge function pattern already in place for other scheduled jobs.
- Email digest reuses the branded HTML shell from `buildBrandedEmailHtml`.
