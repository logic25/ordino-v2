
-- Migrate existing data to new status values
UPDATE public.proposals SET status = 'sent' WHERE status = 'signed_internal';
UPDATE public.proposals SET status = 'executed' WHERE status IN ('accepted', 'signed_client');

-- Update the follow-up trigger to use new status names
CREATE OR REPLACE FUNCTION public.set_proposal_follow_up()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
    NEW.next_follow_up_date := CURRENT_DATE + COALESCE(NEW.follow_up_interval_days, 7);
    NEW.follow_up_count := 0;
  END IF;
  -- Clear follow-up when executed or lost
  IF NEW.status IN ('executed', 'lost', 'expired') THEN
    NEW.next_follow_up_date := NULL;
    NEW.follow_up_dismissed_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;
