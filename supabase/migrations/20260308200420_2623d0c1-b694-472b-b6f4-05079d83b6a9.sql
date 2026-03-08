-- Add source column to feature_requests to track origin (manual, beacon, etc.)
ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- Add beacon_feedback_id to link back to the original Beacon feedback
ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS beacon_feedback_id integer REFERENCES public.beacon_feedback(id);