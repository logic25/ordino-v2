
-- BD Comp & Scorecard + prior-turn BD columns/tables (idempotent)

ALTER TABLE public.bd_events
  ADD COLUMN IF NOT EXISTS bonus_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_goal integer;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS bd_sourced boolean,
  ADD COLUMN IF NOT EXISTS bd_sourced_confirmed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS intro_sent_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_comp_admin boolean NOT NULL DEFAULT false;

UPDATE public.profiles SET is_comp_admin = true
  WHERE id IN ('a4c1d2da-920e-4bfa-a8bd-d73c792b0e90', 'e3beb106-4daa-4e85-a8f1-6bf86feb76e2');

CREATE TABLE IF NOT EXISTS public.bd_eligible_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  organization text,
  cadence text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_eligible_events TO authenticated;
GRANT ALL ON public.bd_eligible_events TO service_role;
ALTER TABLE public.bd_eligible_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bd_eligible_events_company" ON public.bd_eligible_events;
CREATE POLICY "bd_eligible_events_company" ON public.bd_eligible_events
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
DROP TRIGGER IF EXISTS trg_bd_eligible_events_updated_at ON public.bd_eligible_events;
CREATE TRIGGER trg_bd_eligible_events_updated_at BEFORE UPDATE ON public.bd_eligible_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_comp_admin(_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_comp_admin FROM public.profiles WHERE user_id = _user LIMIT 1), false);
$$;

CREATE TABLE IF NOT EXISTS public.bd_comp_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_salary numeric NOT NULL DEFAULT 0,
  event_bonus_amount numeric NOT NULL DEFAULT 250,
  new_client_bonus_amount numeric NOT NULL DEFAULT 1000,
  small_contract_pct numeric NOT NULL DEFAULT 50,
  small_contract_threshold numeric NOT NULL DEFAULT 2000,
  revenue_bonus_pct numeric NOT NULL DEFAULT 2,
  revenue_window_months integer NOT NULL DEFAULT 12,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, person_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_comp_plans TO authenticated;
GRANT ALL ON public.bd_comp_plans TO service_role;
ALTER TABLE public.bd_comp_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bd_comp_plans_select" ON public.bd_comp_plans;
CREATE POLICY "bd_comp_plans_select" ON public.bd_comp_plans
  FOR SELECT TO authenticated USING (
    public.is_company_member(company_id)
    AND (public.is_comp_admin() OR person_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1))
  );
DROP POLICY IF EXISTS "bd_comp_plans_admin_write" ON public.bd_comp_plans;
CREATE POLICY "bd_comp_plans_admin_write" ON public.bd_comp_plans
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id) AND public.is_comp_admin())
  WITH CHECK (public.is_company_member(company_id) AND public.is_comp_admin());
DROP TRIGGER IF EXISTS trg_bd_comp_plans_updated_at ON public.bd_comp_plans;
CREATE TRIGGER trg_bd_comp_plans_updated_at BEFORE UPDATE ON public.bd_comp_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.bd_bonus_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('EVENT','NEW_CLIENT','REVENUE')),
  source_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACCRUED' CHECK (status IN ('ACCRUED','APPROVED','PAID')),
  accrued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  paid_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_bonus_ledger TO authenticated;
GRANT ALL ON public.bd_bonus_ledger TO service_role;
ALTER TABLE public.bd_bonus_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bd_bonus_ledger_select" ON public.bd_bonus_ledger;
CREATE POLICY "bd_bonus_ledger_select" ON public.bd_bonus_ledger
  FOR SELECT TO authenticated USING (
    public.is_company_member(company_id)
    AND (public.is_comp_admin() OR person_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1))
  );
DROP POLICY IF EXISTS "bd_bonus_ledger_admin_write" ON public.bd_bonus_ledger;
CREATE POLICY "bd_bonus_ledger_admin_write" ON public.bd_bonus_ledger
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id) AND public.is_comp_admin())
  WITH CHECK (public.is_company_member(company_id) AND public.is_comp_admin());
CREATE UNIQUE INDEX IF NOT EXISTS bd_bonus_ledger_event_uniq
  ON public.bd_bonus_ledger (person_id, type, (source_ref->>'lead_id'))
  WHERE type = 'EVENT';
CREATE UNIQUE INDEX IF NOT EXISTS bd_bonus_ledger_newclient_uniq
  ON public.bd_bonus_ledger (person_id, type, (source_ref->>'proposal_id'))
  WHERE type = 'NEW_CLIENT';
DROP TRIGGER IF EXISTS trg_bd_bonus_ledger_updated_at ON public.bd_bonus_ledger;
CREATE TRIGGER trg_bd_bonus_ledger_updated_at BEFORE UPDATE ON public.bd_bonus_ledger
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.bd_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start date,
  period_end date,
  event_id uuid REFERENCES public.bd_events(id) ON DELETE CASCADE,
  metric text NOT NULL,
  target integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_goals TO authenticated;
GRANT ALL ON public.bd_goals TO service_role;
ALTER TABLE public.bd_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bd_goals_company" ON public.bd_goals;
CREATE POLICY "bd_goals_company" ON public.bd_goals
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
DROP TRIGGER IF EXISTS trg_bd_goals_updated_at ON public.bd_goals;
CREATE TRIGGER trg_bd_goals_updated_at BEFORE UPDATE ON public.bd_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.accrue_event_bonus_on_lead_qualified()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_person uuid;
  v_plan public.bd_comp_plans%ROWTYPE;
BEGIN
  IF NEW.stage IS DISTINCT FROM 'QUALIFIED' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage IS NOT DISTINCT FROM 'QUALIFIED' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.bd_sourced, false) = false OR NEW.event_id IS NULL THEN RETURN NEW; END IF;
  v_person := COALESCE(NEW.assigned_to, NEW.created_by);
  IF v_person IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_plan FROM public.bd_comp_plans
    WHERE company_id = NEW.company_id AND person_id = v_person AND active = true LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  INSERT INTO public.bd_bonus_ledger (company_id, person_id, type, source_ref, amount, status, notes)
  VALUES (
    NEW.company_id, v_person, 'EVENT',
    jsonb_build_object('lead_id', NEW.id, 'event_id', NEW.event_id),
    v_plan.event_bonus_amount, 'ACCRUED',
    'Event bonus: ' || COALESCE(NEW.full_name, 'lead') || ' qualified'
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_accrue_event_bonus ON public.leads;
CREATE TRIGGER trg_accrue_event_bonus AFTER INSERT OR UPDATE OF stage ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.accrue_event_bonus_on_lead_qualified();

CREATE OR REPLACE FUNCTION public.accrue_new_client_bonus_on_proposal_executed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_person uuid;
  v_plan public.bd_comp_plans%ROWTYPE;
  v_total numeric;
  v_is_new boolean;
  v_amount numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM 'executed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'executed' THEN RETURN NEW; END IF;
  SELECT * INTO v_lead FROM public.leads
    WHERE proposal_id = NEW.id AND COALESCE(bd_sourced, false) = true
    ORDER BY created_at ASC LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  v_person := COALESCE(v_lead.assigned_to, v_lead.created_by);
  IF v_person IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_plan FROM public.bd_comp_plans
    WHERE company_id = NEW.company_id AND person_id = v_person AND active = true LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  v_is_new := NOT EXISTS (
    SELECT 1 FROM public.proposals
    WHERE client_id = NEW.client_id AND status = 'executed' AND id <> NEW.id
  );
  IF NOT v_is_new THEN RETURN NEW; END IF;
  v_total := COALESCE(NEW.total_amount, NEW.subtotal, 0);
  IF v_total >= v_plan.small_contract_threshold THEN
    v_amount := v_plan.new_client_bonus_amount;
  ELSE
    v_amount := ROUND(v_total * v_plan.small_contract_pct / 100.0, 2);
  END IF;
  INSERT INTO public.bd_bonus_ledger (company_id, person_id, type, source_ref, amount, status, notes)
  VALUES (
    NEW.company_id, v_person, 'NEW_CLIENT',
    jsonb_build_object('proposal_id', NEW.id, 'lead_id', v_lead.id, 'client_id', NEW.client_id, 'contract_total', v_total),
    v_amount, 'ACCRUED',
    'New-client bonus: proposal ' || COALESCE(NEW.proposal_number, NEW.id::text)
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_accrue_newclient_bonus ON public.proposals;
CREATE TRIGGER trg_accrue_newclient_bonus AFTER INSERT OR UPDATE OF status ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.accrue_new_client_bonus_on_proposal_executed();

CREATE OR REPLACE FUNCTION public.notify_comp_admins_new_bd_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_profile record;
BEGIN
  IF COALESCE(NEW.bd_sourced, false) = false THEN RETURN NEW; END IF;
  FOR admin_profile IN
    SELECT id FROM public.profiles WHERE company_id = NEW.company_id AND is_comp_admin = true
  LOOP
    INSERT INTO public.notifications (company_id, user_id, type, title, body, link)
    VALUES (
      NEW.company_id, admin_profile.id, 'bd_lead_new',
      'New BD lead: ' || COALESCE(NEW.full_name, 'Unknown'),
      COALESCE(NEW.company, '') || COALESCE(' — ' || NEW.role, ''),
      '/bd/leads/' || NEW.id::text
    );
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_comp_admins_new_bd_lead ON public.leads;
CREATE TRIGGER trg_notify_comp_admins_new_bd_lead AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.notify_comp_admins_new_bd_lead();

INSERT INTO public.bd_comp_plans
  (company_id, person_id, base_salary, event_bonus_amount, new_client_bonus_amount,
   small_contract_pct, small_contract_threshold, revenue_bonus_pct, revenue_window_months, active)
SELECT company_id, id, 92500, 250, 1000, 50, 2000, 2, 12, true
FROM public.profiles WHERE id = '2b2a80aa-ba20-498f-a4ff-48d0505cb41a'
ON CONFLICT (company_id, person_id) DO NOTHING;

INSERT INTO public.bd_eligible_events (company_id, name, organization, cadence, active)
SELECT id, 'REBNY Breakfast Series', 'REBNY', 'monthly', true FROM public.companies
WHERE NOT EXISTS (SELECT 1 FROM public.bd_eligible_events b WHERE b.company_id = public.companies.id AND b.name = 'REBNY Breakfast Series');
INSERT INTO public.bd_eligible_events (company_id, name, organization, cadence, active)
SELECT id, 'AIA NY', 'AIA New York', 'monthly', true FROM public.companies
WHERE NOT EXISTS (SELECT 1 FROM public.bd_eligible_events b WHERE b.company_id = public.companies.id AND b.name = 'AIA NY');

INSERT INTO public.changelog_entries (company_id, title, description, tag)
SELECT id, 'BD Comp & Scorecard launched',
  'Tracks event/new-client/revenue bonuses, a BD scorecard per person, and a comp-admin rollup. Adds Mark intro sent on leads, BD-sourced reporting (90d), and morning-briefing follow-ups.',
  'feature'
FROM public.companies;
