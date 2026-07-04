-- ============================================================
-- Migration: Dial down over-firing pg_cron jobs
-- ============================================================
--
-- Audit ran 2026-06-12 (see cron.job vs cron.job_run_details).
-- Four jobs were firing far more often than their work warranted:
--
--   process-scheduled-emails    every 1 min  → 1,440 runs/day
--   process-email-reminders     every 5 min  →   288 runs/day
--   process-bd-sequences        every 5 min  →   288 runs/day
--   process-billing-schedules   every 15 min →    96 runs/day
--
-- All four wake up, check a queue/table, and most ticks find
-- nothing to do. Individually each empty tick is cheap, but at
-- ~2,100 wakeups/day combined it's pure noise on the Cloud
-- usage line.
--
-- Rationale for each new cadence:
--
--   process-scheduled-emails  → */10 * * * *  (10 min)
--     Only drains future-dated emails (send_at column). User
--     "send now" flows go through gmail-send directly, not this
--     queue, so latency on this path is invisible.
--
--   process-email-reminders   → */15 * * * *  (15 min)
--     Reminders are user-time scoped (hours, not minutes). A
--     reminder due at 2:00 PM going at 2:05 is fine.
--
--   process-bd-sequences      → 0 * * * *     (hourly)
--     BD sequences are day-level granularity (step 2 = 3 days
--     after step 1). 5-minute polling was 12× too aggressive.
--     Per-owner 25/day cap is unchanged.
--
--   process-billing-schedules → 0 * * * *     (hourly)
--     Billing schedules resolve to daily/weekly/monthly. Hourly
--     polling is already overkill for the use case.
--
-- Total cron noise: ~2,100 runs/day → ~125 runs/day (17× fewer).
--
-- Honest scope note: this is hygiene, not a major cost cut.
-- Empty cron ticks were nearly free. The real AI-token cost
-- driver (nightly-summarize-projects on a large legacy
-- project set) is addressed in a follow-up migration.
--
-- All four use cron.alter_job to preserve job IDs, bodies,
-- and database settings configured by the original Lovable
-- dashboard provisioning. Each guarded so missing jobs are
-- skipped silently (safe to re-run, safe in fresh envs).
-- ============================================================

DO $$
DECLARE
  v_jobid bigint;
  v_count int := 0;
BEGIN
  -- process-scheduled-emails: every 1 min → every 10 min
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'process-scheduled-emails';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := v_jobid, schedule := '*/10 * * * *');
    v_count := v_count + 1;
    RAISE NOTICE 'process-scheduled-emails: rescheduled to */10 * * * * (jobid=%)', v_jobid;
  ELSE
    RAISE NOTICE 'process-scheduled-emails: job not found, skipping';
  END IF;

  -- process-email-reminders: every 5 min → every 15 min
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'process-email-reminders';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := v_jobid, schedule := '*/15 * * * *');
    v_count := v_count + 1;
    RAISE NOTICE 'process-email-reminders: rescheduled to */15 * * * * (jobid=%)', v_jobid;
  ELSE
    RAISE NOTICE 'process-email-reminders: job not found, skipping';
  END IF;

  -- process-bd-sequences: every 5 min → hourly
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'process-bd-sequences-every-5min';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := v_jobid, schedule := '0 * * * *');
    v_count := v_count + 1;
    RAISE NOTICE 'process-bd-sequences-every-5min: rescheduled to 0 * * * * (jobid=%)', v_jobid;
  ELSE
    RAISE NOTICE 'process-bd-sequences-every-5min: job not found, skipping';
  END IF;

  -- process-billing-schedules: every 15 min → hourly
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'process-billing-schedules';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := v_jobid, schedule := '0 * * * *');
    v_count := v_count + 1;
    RAISE NOTICE 'process-billing-schedules: rescheduled to 0 * * * * (jobid=%)', v_jobid;
  ELSE
    RAISE NOTICE 'process-billing-schedules: job not found, skipping';
  END IF;

  RAISE NOTICE 'cron dial-down complete: % job(s) updated', v_count;
END $$;
