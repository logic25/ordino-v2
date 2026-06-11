# Smarter Bill-Date Prediction + Continuous Learning

## The single source of truth for "typical" durations

We already compute per-service-type baselines in `useServiceLevelReport.ts`:
- `avgDays` (created → completed/billed)
- `avgTimelogHrs` (actual work time)

The predictor today **ignores this** and rolls its own historical mean. We unify both around one cached baseline table so Service Level Report, predictor, dashboards, and Beacon all use the same numbers.

### Fixing the "flawed" baseline
The current `avgDays` mixes real work time + idle/forgotten time. Two improvements:
1. **Track work-active days vs idle days** — for each completed service compute `active_days` (days with ≥1 time activity logged) vs `idle_days` (gap days). Use `active_days` as the "true" cycle time. Idle days flag operational gaps, not service difficulty.
2. **Trim outliers** — drop top/bottom 10% before averaging (winsorize). One service that sat for 400 days shouldn't poison the bucket.

## Architecture: the learning loop

```text
          ┌──────────────────────────────┐
          │ service_duration_baselines   │  ← single cached table, recomputed nightly
          │ key: (service_type,          │
          │       complexity,            │
          │       building_class,        │
          │       client_tier,           │
          │       is_pro_cert)           │
          │ value: median_active_days,   │
          │        median_total_days,    │
          │        median_hours,         │
          │        sample_size,          │
          │        std_dev, p20, p80     │
          └──────────────┬───────────────┘
                         │ feeds
   ┌─────────────────────┼────────────────────────────┐
   │                     │                            │
   ▼                     ▼                            ▼
Service Level     predict-service-dates       Beacon / dashboards
   report          (per-service prediction)       (benchmarks)
                         │
                         ▼
                  prediction_outcomes  ← logs predicted vs actual
                         │
                         ▼
                  nightly recompute → refines baselines  (the loop)
```

## Schema changes (one migration)

1. `services.is_pro_cert boolean default false` (if missing) — captured at proposal/service creation.
2. `proposals.is_pro_cert boolean default false` and a question in the proposal builder: "Will this be a Professional Certification filing?" Carries through to services on conversion.
3. `clients.client_tier text` (auto-derived enum-like: `fast`, `normal`, `slow`) from `client_payment_analytics.avg_days_to_pay` (<30, 30–60, >60). Recomputed nightly.
4. `service_duration_baselines` table (cache, multi-dimensional):
   - `service_type, complexity, building_class, client_tier, is_pro_cert`
   - `median_active_days, median_total_days, median_hours, sample_size, p20_days, p80_days, std_dev_days, computed_at`
5. `prediction_outcomes` (feedback log):
   - `service_id, predicted_date, predicted_at, actual_billed_date, error_days, prediction_inputs jsonb, model_version`
6. `services.bill_date_reasoning text`, `services.estimated_bill_date_computed_at timestamptz`.

## predict-service-dates rewrite

For each open service:

1. **Lookup baseline** with progressive fallback:
   - Try most specific key (type + complexity + building_class + client_tier + is_pro_cert). If `sample_size ≥ 5`, use it.
   - Fall back: drop building_class → drop client_tier → drop complexity → type+pro_cert only → type only → global median.
   - Track which fallback level was used; surface in `reasoning`.

2. **Pick anchor by stage** (`status` field):
   - `not_started` / `pending` → anchor = `project.created_at` or today, use full `median_active_days`
   - `in_progress` / `filed` → anchor = `filed_at || svc.created_at`; remaining = `median_active_days − age_active_days`, floor at 7
   - `objections` → anchor = `objections_received_at || updated_at`; add objection-resolution baseline (its own type bucket)
   - `approved` / `ready_to_bill` → today + 3–5 days

3. **Project-note context (AI extractor)** — only when notes changed since last prediction:
   - Send last 10 `project_notes` + service `status_notes` to Lovable AI Gateway (Gemini Flash) with a structured JSON schema asking for `blockers`, `stage_hint`, `days_adjustment (-14..+60)`, `reasoning`.
   - Apply `days_adjustment`, cache result by `(service_id, notes_hash)` in `service_prediction_cache`.

4. **Clamp + emit**:
   - Final date within `[today+3, today+365]`.
   - Write back to `services.estimated_bill_date` + `bill_date_source='ai'` + `bill_date_reasoning` (human-readable: "Median active days for PW1/normal/residential/normal-paying client (n=23): 38d. Notes flag: awaiting owner sig +7d. PM workload +5d.").
   - Insert `prediction_outcomes` row with `predicted_date` + full `prediction_inputs` jsonb.

5. **On bill** (trigger): when a service flips to `billed`, update the matching `prediction_outcomes` row with `actual_billed_date` + `error_days`. This is the feedback signal.

## Nightly cron: recompute baselines + accuracy

New cron job (pg_cron + edge function `recompute-baselines`):
1. For every `(type, complexity, building_class, client_tier, is_pro_cert)` group with ≥3 completed services in the last 365 days:
   - Compute median active days (winsorized 10/90), median total days, median hours, p20, p80, std_dev, sample_size.
   - Upsert into `service_duration_baselines`.
2. Compute rolling 30-day prediction accuracy: `% of outcomes where |error_days| ≤ 14`, by service type. Store in `prediction_accuracy_history`.
3. Recompute `client_tier` for every client based on latest payment analytics.

## How accuracy improves over time (the answer to "what do we need to do")

| Driver | Action | Expected accuracy gain |
|---|---|---|
| Clean service-type taxonomy | Expand bucket regex + add `is_pro_cert` flag | +20% |
| Stage-aware anchor (not project.created_at) | Use `filed_at`, `objections_received_at` | +15% |
| Multi-dimensional baseline (type × complexity × building × client × pro_cert) | New cache table + fallback ladder | +10% |
| Project-notes AI context | Gemini Flash extractor on notes | +5–10% |
| PM workload adjustment | Open-service count vs company median | +3–5% |
| Feedback loop (after 3 months of data) | Auto-tune multipliers from `prediction_outcomes` error | +10–15% |
| Discipline: PMs keep `status` + `filed_at` current | UI nudge when status is stale >14d | +5% |
| Discipline: PMs write blockers in notes | Inline reminder when service is overdue vs baseline | +5% |

Realistic trajectory toward ~80% within ±14 days:
- Today: ~25–35%
- Ship Part A baselines + stage anchor + pro_cert: ~55–60%
- Add notes AI extractor + workload: ~65–70%
- 3 months of `prediction_outcomes` data + nightly tuning: ~75–82%

## Continuous improvement features users see

1. **"Prediction Accuracy" card** on Accounting dashboard: rolling 30-day "% within 14d" by service type, with trend arrow. Makes the learning visible.
2. **"Why this date?"** popover on every predicted date in the pipeline: shows baseline used, sample size, stage anchor, notes adjustment, workload adjustment.
3. **"This prediction was off"** thumbs-down on each row → writes a row to `prediction_feedback` so we can investigate systematic misses.
4. **Pro Cert filter** on Service Level Report — see Pro Cert PW1 vs standard PW1 side-by-side once we have data.
5. **Per-client / per-building-class drill-down** on Service Level Report (re-uses baseline table dimensions).

## Part B — Billing Pipeline pagination (unchanged from prior plan)

- Default page size 10; dropdown 10 / 25 / 50 / 100 / All
- Sticky footer: `‹ Prev | Page 1 of 10 | Next ›` + "Showing 1–10 of 97" + filtered $ total
- Search box (project, service, PM) filters before paginating
- Sticky table header on scroll
- Persist page size per user in `profiles.notification_preferences.pipeline_prefs`

## Files

- `supabase/migrations/<ts>_prediction_intelligence.sql` — new tables, columns, indexes
- `supabase/functions/predict-service-dates/index.ts` — full rewrite per above
- `supabase/functions/recompute-baselines/index.ts` (new) — nightly job
- `supabase/functions/log-prediction-outcome/index.ts` (new) — called from a trigger when service flips to billed
- pg_cron schedule for nightly recompute (via insert tool, not migration)
- `src/components/billing/BillingPipelineTable.tsx` — pagination, search, "Why this date?" popover, thumbs-down
- `src/hooks/useBillingPipeline.ts` — pass through reasoning + accuracy
- `src/components/dashboard/PredictionAccuracyCard.tsx` (new)
- `src/hooks/useServiceLevelReport.ts` — read from `service_duration_baselines` cache + add `medianActiveDays`, `medianHours`
- `src/components/reports/ServiceLevelReport.tsx` — add Pro Cert / building-class / client-tier filters
- `src/components/proposals/ProposalDialog.tsx` (or equivalent) — add "Professional Certification?" toggle
- Changelog entry

## Out of scope
- Real ML model — staying with statistical baselines + AI notes extractor
- Backfilling predictions for already-billed services
- Predicting payment date (post-invoice) — different feedback loop, future round
