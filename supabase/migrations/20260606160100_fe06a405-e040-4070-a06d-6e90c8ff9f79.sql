-- BD Sprint 2 — Leads module schema.
-- Additive only. Existing Proposals workflow against `leads` is untouched.

-- 1. leads: BD conversion link, audit actor, soft delete, identity columns
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  -- client_id links a lead to the Company (clients row) it converts into, set at
  -- "Create Proposal from Lead". Idempotent: re-opening the flow reuses it.
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_deleted ON public.leads(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_client ON public.leads(client_id);

-- 2. proposals.lead_id — links a proposal back to the originating lead.
--    NOT NULL intentionally omitted: existing-client / change-order proposals stay NULL.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_lead ON public.proposals(lead_id);

-- 3. Auto-log stage changes to the shared bd_activities thread.
--    Fires on any UPDATE OF stage — grid inline edit, detail pill, or direct DB write.
--    Actor = the app-set updated_by; falls back to assigned_to for raw DB updates.
CREATE OR REPLACE FUNCTION public.log_lead_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') AND (OLD.stage IS DISTINCT FROM NEW.stage) THEN
    INSERT INTO public.bd_activities (
      company_id, lead_id, type, content, metadata, created_by, created_at
    ) VALUES (
      NEW.company_id,
      NEW.id,
      'STAGE_CHANGE',
      'Stage changed: ' || COALESCE(OLD.stage::text, 'null') || ' → ' || NEW.stage::text,
      jsonb_build_object('from_stage', OLD.stage, 'to_stage', NEW.stage),
      COALESCE(NEW.updated_by, NEW.assigned_to),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_lead_stage_change ON public.leads;
CREATE TRIGGER trg_lead_stage_change
  AFTER UPDATE OF stage ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_lead_stage_change();

-- 4. lead_views — per-user saved views for the Leads grid.
CREATE TABLE IF NOT EXISTS public.lead_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  columns_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,

  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_lead_views_user ON public.lead_views(user_id);

ALTER TABLE public.lead_views ENABLE ROW LEVEL SECURITY;

-- Saved views are private to the owning user.
CREATE POLICY "Users manage their own lead views — select"
  ON public.lead_views FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage their own lead views — insert"
  ON public.lead_views FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their own lead views — update"
  ON public.lead_views FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their own lead views — delete"
  ON public.lead_views FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_lead_views_updated_at
  BEFORE UPDATE ON public.lead_views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
