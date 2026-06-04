## 1. Switch low-stakes AI features to Gemini 2.5 Flash-Lite

Update the model string on these 11 edge functions (~5-8× cheaper, no quality loss for structured/classification work):

- `summarize-project`, `cleanup-notes`, `extract-tasks`, `extract-rfp`, `parse-objection`
- `predict-payment-risk`, `generate-changelog`, `triage-bug-report`
- `monitor-rfps` (both call sites), `process-automation-rules`

**Keep on Flash** (outbound writing / interactive — tone matters): `ask-ordino`, `draft-checklist-followup`, `draft-proposal-followup`, `generate-rfp-cover-letter`, `auto-checklist-followups`, `generate-project-checklist`.

**Keep on Pro:** `code-research`. **Beacon AI** untouched.

## 2. Make the pending-approval pill actionable

- New `ApproveExpenseDialog` (amount, vendor, category, project link, receipt, Approve / Reject / Open project).
- Wire to **every pending pill**: dashboard `ExpenseApprovalsCard`, project Expenses subsection (add buttons — currently missing), email "Review & Approve" link → `/projects/:id?expense=:id&action=approve` auto-opens the dialog.
- Reuses existing `useApproveExpense` mutation.

## 3. Replace unused Open Services email with a **Monday Meeting Report**

Sent Sunday 11 PM ET to PMs + leadership, mirrored at `/reports/monday-meeting`. Built by new `generate-monday-report` edge function (Flash — runs weekly, quality matters).

1. **Top of mind this week** — 5-8 projects AI-ranked by urgency. Each: project #, address, one-sentence "what's happening / what's needed" (pulled from latest `project_notes` AI summary).
2. **Filings expected this week** — uses the existing `predictBillDates` learner (already in `useBillDatePrediction.ts`) which infers per-service-type duration from historical `services.billed_at` vs `created_at`, then adjusts for open-checklist buffer. Shows services whose **predicted** date falls in the next 7 days, grouped by PM, with a confidence band (±N days, sample count). Manual `estimated_filing_date` is used as an override when set; otherwise the prediction is the source of truth. Predictions get more accurate as more services close.
3. **Where someone needs help** — blocked projects (`waiting_on` >7 days, 3+ unanswered emails, stalled checklist, or stale per §5) + suggested helper from team availability.
4. **Just-closed / wins** — last 7 days: filings, approvals, COs signed.
5. **Numbers** — # active, # filings predicted this week, # blocked, $ billed last week, $ outstanding.

Old "Open Services" email becomes opt-in toggle in notification prefs.

## 4. Promote the predicted-date learner project-wide

Since we're leaning on it for the Monday Report, also surface it everywhere a filing date appears:
- **Service rows** — show predicted date with a small "AI · ±Nd · N samples" tooltip when no manual estimate is set; manual estimate wins when present.
- **Project page header** — "Next predicted filing: …" line.
- **Move logic to a new `predict-service-dates` edge function** so it runs server-side for crons (Monday Report) instead of being client-only. Frontend hook calls the same function for consistency.
- Backfill nothing — predictions are computed on read; no schema change needed.

## 5. AI Usage page refinements

- **Cost projection** card per feature ("Project Summaries: ~$X/mo, ~$Y/yr at current pace").
- **Top spenders** table sorted by $/mo.
- **Budget alert threshold** — admin sets monthly cap; banner + notification when projected spend crosses it.
- New `ai_budget_settings` table (company-scoped, admin-only RLS + GRANTs).

## 6. Stale-project tracking (backend + UI only — no daily email)

Future Beacon nudge will use this signal to proactively DM PMs.

- Add `projects.last_activity_at` (timestamptz) + `projects.stale_threshold_days` (int, nullable) via migration.
- Trigger updates `last_activity_at` on insert/update of `project_notes`, `email_project_tags`, `project_checklist_items`, `activities`, `services`, `change_orders`, and `projects.status`. Backfill from latest of those.
- **UI**: red "Stale — X days" pill on the projects list + "Stale" filter chip. Monday Report's "Where someone needs help" pulls from this signal.

## Technical notes

- **Migrations**: `projects.last_activity_at` + `stale_threshold_days` + trigger + backfill; `ai_budget_settings` table.
- **Edge functions**: model swaps on the 11 in §1; new `generate-monday-report` (cron Sun 11 PM ET); new `predict-service-dates` (server-side port of `useBillDatePrediction`).
- **Frontend**: `AIUsageDashboard.tsx` (projection + top spenders + banner); new `AIBudgetSettings.tsx`; new `ApproveExpenseDialog.tsx` wired to all pills; projects list stale pill + filter; new `MondayReport.tsx` route; predicted-date badges on service rows + project header; notification prefs add "Weekly Monday report" (on) + "Legacy open-services report" (off).

Ready to ship.