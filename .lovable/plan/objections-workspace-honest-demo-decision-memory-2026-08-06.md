# Objections Workspace: honest demo + decision memory

Four changes to the Project detail Research → Objections workspace. The demo stays — it just gets labeled.

## 1. Honest demo

- Rename both "Import Demo" buttons to "Load Demo Objections (training)".
- Add a `source` column to `objection_items` (text, default `'real'`). The demo insert sets `source = 'demo'`.
- Objection cards show a small muted "Demo" badge when the row has no objection letter and `source = 'demo'`.
- The existing Reset button keeps clearing rows (it already deletes all objections for the project).

## 2. Capture the why on resolve

- The notes box heading stays "Your Notes"; the placeholder becomes: "Why did we make this call? (the thinking a future teammate will need)".
- New table `decision_records` holding: objection text, code reference, filing type, recommendation (the response draft), reasoning (the resolution notes), project, company, who resolved it and when, `status = 'pending_review'`, `source = 'objection-resolution'`. Only staff of the same company can read/write their own company's records.
- When an objection is marked Resolved and either a response draft or notes exist, a decision record is inserted automatically. If neither exists, nothing is written (no empty records).
- New "Decision Log" sub-tab next to Objections and Code Research, listing decision records for the company with a search box matching code section, objection text, recommendation, and reasoning. Each entry shows code reference, filing type, recommendation, reasoning, who resolved it and when, plus a "Pending review" badge. Honest empty state when there is nothing yet.

## 3. Draft Response uses GLE's knowledge

`handleDraftResponse` gains context before calling Beacon (still RAG-first through beacon-proxy chat):

- The PM's current notes for that objection.
- Any prior Beacon Research answers already in the session for that objection.
- Up to ~5 prior `decision_records` matching the same code reference (company-scoped, most recent first), passed as "here's how we've resolved this section before" with each recommendation + reasoning.

The 2–4 plain-sentence output rule and markdown stripping stay as-is.

## 4. Relabel

"Clean Up with Beacon" → "Clean Up (AI polish)" (it calls the `cleanup-notes` base model, not Beacon). The result panel label "Beacon's Version" becomes "Polished Version" for consistency.

## Technical notes

- Migration: `ALTER TABLE public.objection_items ADD COLUMN source text NOT NULL DEFAULT 'real'`; `CREATE TABLE public.decision_records (...)` with grants to authenticated/service_role, RLS enabled, company-scoped policies via `get_user_company_id()`, index on `(company_id, code_reference)`, and an `updated_at` trigger.
- New hook `src/hooks/useDecisionRecords.ts`: list (company-scoped, optional search), lookup by code reference, and create.
- `ResearchTabContainer.tsx` gains the third tab rendering a new `DecisionLogPanel.tsx`.
- Changelog entry inserted in the same task.
