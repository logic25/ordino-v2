
CREATE OR REPLACE FUNCTION public.sync_lead_stage_from_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.bd_lead_stage;
  v_current public.bd_lead_stage;
BEGIN
  -- Only fire when status actually transitions
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('signed_client','accepted','executed') THEN
    v_target := 'WON';
  ELSIF NEW.status IN ('lost','rejected','expired') THEN
    v_target := 'LOST';
  ELSE
    RETURN NEW;
  END IF;

  BEGIN
    SELECT stage INTO v_current FROM public.leads WHERE id = NEW.lead_id;
    -- Forward-only: terminal stages (WON/LOST) are sticky
    IF v_current IS NULL OR v_current IN ('WON','LOST') THEN
      RETURN NEW;
    END IF;

    UPDATE public.leads
       SET stage = v_target,
           status = CASE WHEN v_target = 'WON' THEN 'won'
                         WHEN v_target = 'LOST' THEN 'lost'
                         ELSE status END,
           updated_at = now()
     WHERE id = NEW.lead_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sync_lead_stage_from_proposal failed for proposal % lead %: %',
      NEW.id, NEW.lead_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_stage_from_proposal ON public.proposals;
CREATE TRIGGER trg_sync_lead_stage_from_proposal
AFTER INSERT OR UPDATE OF status ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.sync_lead_stage_from_proposal();
