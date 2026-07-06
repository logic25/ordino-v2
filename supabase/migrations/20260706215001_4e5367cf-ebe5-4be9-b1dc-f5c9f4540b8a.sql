-- Allow bd_activities to belong to a referral (in addition to lead/event).
-- Prior constraint only permitted lead XOR event, which silently blocked
-- referral notes/stage-change activities added in Phase 2.
ALTER TABLE public.bd_activities
  DROP CONSTRAINT IF EXISTS bd_activities_exactly_one_parent;

ALTER TABLE public.bd_activities
  ADD CONSTRAINT bd_activities_exactly_one_parent CHECK (
    (
      (CASE WHEN lead_id     IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN event_id    IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN referral_id IS NOT NULL THEN 1 ELSE 0 END)
    ) = 1
  );