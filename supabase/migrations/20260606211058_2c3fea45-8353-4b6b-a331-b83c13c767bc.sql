-- leads: identity + BD conversion link + audit actor + soft delete
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_deleted ON public.leads(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_client  ON public.leads(client_id);

-- proposals → originating lead
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_lead ON public.proposals(lead_id);

-- auto-log stage changes to bd_activities
CREATE OR REPLACE FUNCTION public.log_lead_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') AND (OLD.stage IS DISTINCT FROM NEW.stage) THEN
    INSERT INTO public.bd_activities (company_id, lead_id, type, content, metadata, created_by, created_at)
    VALUES (
      NEW.company_id, NEW.id, 'STAGE_CHANGE',
      'Stage changed: ' || COALESCE(OLD.stage::text,'null') || ' → ' || NEW.stage::text,
      jsonb_build_object('from_stage', OLD.stage, 'to_stage', NEW.stage),
      COALESCE(NEW.updated_by, NEW.assigned_to), now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_lead_stage_change ON public.leads;
CREATE TRIGGER trg_lead_stage_change
  AFTER UPDATE OF stage ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_stage_change();