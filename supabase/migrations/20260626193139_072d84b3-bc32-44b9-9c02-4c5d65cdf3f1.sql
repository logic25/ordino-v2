
-- Phase 2: add referral_id to bd_activities, lost_reason to bd_referrals
ALTER TABLE public.bd_activities
  ADD COLUMN IF NOT EXISTS referral_id uuid NULL REFERENCES public.bd_referrals(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bd_activities_referral_id
  ON public.bd_activities(referral_id) WHERE referral_id IS NOT NULL;

ALTER TABLE public.bd_referrals
  ADD COLUMN IF NOT EXISTS lost_reason text NULL;
