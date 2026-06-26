-- Add 'needs_attention' to the filing_runs status enum.
--
-- The dob-agent verifier (Change 2 of the re-architecture) stops a filing as
-- 'needs_attention' when a DOM read-back finds a field mismatch / empty /
-- stale selector / error banner. This must be a distinct, terminal status —
-- a verification failure must NEVER be presented to the PM as 'review_needed'
-- (which implies the form is filled and ready). Without this, the agent's
-- callback UPDATE would violate the CHECK constraint and the run would appear
-- stuck.

ALTER TABLE public.filing_runs
  DROP CONSTRAINT IF EXISTS filing_runs_status_check;

ALTER TABLE public.filing_runs
  ADD CONSTRAINT filing_runs_status_check
  CHECK (status IN (
    'queued', 'running', 'completed', 'failed', 'review_needed', 'needs_attention'
  ));
