## 1. Resize everything — all four dashboards

Only the Admin dashboard uses the resizable widget grid (`useDashboardLayout`). `AccountingView`, `ManagerView`, and `PMDailyView` are hardcoded grids.

- Remove `lockedFull` from every Admin widget so users can resize all of them (kpis, sales-health, conversion, revenue-trend, team-utilization, billing-pipeline, open-services, etc.).
- Wrap `AccountingView`, `ManagerView`, `PMDailyView` in the same `DndContext` + `useDashboardLayout` shell already used by `AdminCompanyView`. Each existing card becomes a widget id; most ids are already declared in `ROLE_WIDGETS`.
- Add the missing widget renderers per role so the layout config actually maps to components.

## 2. Billing Pulse — Accounting vs PM read

Confirming the difference (already in code, but not surfaced to the user):

- **Accounting / Admin** sees two Pulses: **My Billing Pulse** (`scope=self-biller` — invoices *I* issued) and **Company Billing Pulse** (`scope=company` — all invoices). Goal = sum of biller goals or company override.
- **PM** sees **My Billing Pulse** with `scope=self-pm` — services on projects *I* manage that are ready to bill. Goal = my `monthly_goal`.

Fix:
- Add an `InfoTooltip` on every Pulse header that spells out: what's counted, whose goal is used, and the date window. Already-existing `info` icons get real text.
- Add a small "(my issued invoices)" / "(my projects)" / "(company)" subtitle under each Pulse title so the scope is unmistakable at a glance.

## 3. "Sent → Signed 0.7 d n=32" — clarify the label

That cell on **Sales Health** = average **0.7 days** from proposal sent to signed, sample size **32**. The cramped `d n=32` is unreadable.

- Re-format to `0.7 days · 32 proposals` (drop `n=`).
- Same for `Invoice → Paid` and `Proposal → Signed (90d)`.
- Add an `InfoTooltip` per metric describing the formula + time window + scope.

## 4. "Submissions to Bill" wording

Rename the Accounting KPI **"Submissions to Bill" → "Submissions to Invoice"** (value `12`, $9.7k) in `AccountingView.tsx` so it matches everyday accounting language.

## 5. Intelligence behind Open Services & Upcoming Bill dates

There's already an edge function (`predict-service-dates`) and a hook (`useBillDatePrediction`) sitting unused. **No new model training** — that line in the prior plan just meant "we won't train a model from scratch, we'll call the existing AI function." Wiring:

- For any pipeline row with no estimated bill date, call `predict-service-dates`; stamp the row with the predicted date + an **"AI" badge** and `bill_date_source='ai'`. Cache the prediction back to `services.estimated_bill_date` so it doesn't re-run.
- Add an `aiPriorityScore` to `useOpenServicesSummary` (combines age + remaining $) so high-impact stale rows bubble up; show as a colored dot with tooltip.

## 6. Open Services + Service Level tables: page-size cap + "Show all"

- Default 10 rows. Add a **"Show all"** toggle that expands to the full list with a sticky footer for totals.
- Persist the choice per user in `profiles.notification_preferences.report_prefs`.

## 7. Tooltips on every widget

Audit Admin / Accounting / Manager / PM dashboards; every card gets an `InfoTooltip` explaining what it measures and the scope.

## Out of scope

- Pixel-perfect drag-handle resizing (we keep the existing full/half toggle).
- Building a new ML model — we only use the existing `predict-service-dates` function.
- Mobile reflow tweaks.

## Files

- `src/hooks/useDashboardLayout.ts` — drop `lockedFull`, register widget ids for accounting/manager/pm.
- `src/components/dashboard/AccountingView.tsx`, `ManagerView.tsx`, `PMDailyView.tsx` — convert to widgets-map + DndContext shell.
- `src/components/dashboard/BillingPulse.tsx` — scope subtitle + `InfoTooltip`.
- `src/components/dashboard/SalesHealthCard.tsx` — relabel cycle-time cells + tooltips.
- `src/hooks/useBillingPipeline.ts` + `src/components/billing/BillingPipelineTable.tsx` — wire `useBillDatePrediction`, "AI" badge.
- `src/hooks/useOpenServicesSummary.ts` + `src/components/reports/OpenServicesReport.tsx` — `aiPriorityScore`, "Show all" toggle, persisted prefs.
- `src/components/reports/ServiceLevelReport.tsx` — "Show all" toggle.
- Changelog entry.
