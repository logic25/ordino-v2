-- @mentions on activity thread
ALTER TABLE public.bd_activities
  ADD COLUMN IF NOT EXISTS mentioned_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS bd_activities_mentioned_user_ids_idx
  ON public.bd_activities USING gin (mentioned_user_ids);

-- AI-suggested events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'bd_event_status' AND e.enumlabel = 'SUGGESTED'
  ) THEN
    ALTER TYPE public.bd_event_status ADD VALUE 'SUGGESTED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'bd_event_status' AND e.enumlabel = 'DISMISSED'
  ) THEN
    ALTER TYPE public.bd_event_status ADD VALUE 'DISMISSED';
  END IF;
END$$;

ALTER TABLE public.bd_events
  ADD COLUMN IF NOT EXISTS suggested_by_ai boolean NOT NULL DEFAULT false;