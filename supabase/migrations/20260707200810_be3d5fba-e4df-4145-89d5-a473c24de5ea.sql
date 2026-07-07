
-- =========================================================================
-- ORDINO CLIENT PORTAL — PHASE 1
-- =========================================================================

-- Enums --------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.portal_role AS ENUM ('client', 'gle_staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.client_org_type AS ENUM ('brand', 'gc', 'design', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.client_org_member_role AS ENUM ('client_admin', 'client_viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.filing_discipline AS ENUM (
    'building', 'plumbing', 'sprinkler', 'mechanical', 'electrical', 'fire_alarm'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.filing_agency AS ENUM ('DOB', 'FDNY', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.filing_stage AS ENUM (
    'pre_filing', 'filed', 'in_review', 'objections', 'approved', 'permit_issued', 'sign_off'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.filing_event_source AS ENUM ('auto', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.client_action_owner AS ENUM ('gle', 'client', 'agency');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.client_action_status AS ENUM ('open', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- profiles.portal_role ------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portal_role public.portal_role;

-- =========================================================================
-- client_orgs
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.client_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  type public.client_org_type NOT NULL DEFAULT 'other',
  primary_contact_name text,
  primary_contact_email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_orgs TO authenticated;
GRANT ALL ON public.client_orgs TO service_role;
ALTER TABLE public.client_orgs ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- client_org_memberships
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.client_org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_org_id uuid NOT NULL REFERENCES public.client_orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.client_org_member_role NOT NULL DEFAULT 'client_viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_org_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_com_user ON public.client_org_memberships(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_org_memberships TO authenticated;
GRANT ALL ON public.client_org_memberships TO service_role;
ALTER TABLE public.client_org_memberships ENABLE ROW LEVEL SECURITY;

-- Helper: which client_org_ids does the current user belong to? -----------
CREATE OR REPLACE FUNCTION public.user_client_org_ids(_uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_org_id FROM public.client_org_memberships WHERE user_id = _uid;
$$;

CREATE OR REPLACE FUNCTION public.is_gle_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _uid AND portal_role = 'gle_staff'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = _uid AND portal_role IS NULL
  );
$$;

-- =========================================================================
-- buildings
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_org_id uuid NOT NULL REFERENCES public.client_orgs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  address text NOT NULL,
  bin text,
  pm_name text,
  pm_email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_buildings_org ON public.buildings(client_org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buildings TO authenticated;
GRANT ALL ON public.buildings TO service_role;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- projects: add portal linkage columns (non-destructive, nullable)
-- =========================================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_org_id uuid REFERENCES public.client_orgs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS building_id uuid REFERENCES public.buildings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS portal_overall_stage public.filing_stage,
  ADD COLUMN IF NOT EXISTS portal_pct_complete integer,
  ADD COLUMN IF NOT EXISTS portal_next_action text,
  ADD COLUMN IF NOT EXISTS gle_contact_id uuid;

CREATE INDEX IF NOT EXISTS idx_projects_client_org ON public.projects(client_org_id);
CREATE INDEX IF NOT EXISTS idx_projects_building ON public.projects(building_id);

-- =========================================================================
-- filings
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  discipline public.filing_discipline NOT NULL,
  agency public.filing_agency NOT NULL DEFAULT 'DOB',
  filing_number text,
  current_stage public.filing_stage NOT NULL DEFAULT 'pre_filing',
  stage_entered_at timestamptz NOT NULL DEFAULT now(),
  expected_next_milestone text,
  blocked boolean NOT NULL DEFAULT false,
  blocked_reason text,
  blocked_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_filings_project ON public.filings(project_id);
CREATE INDEX IF NOT EXISTS idx_filings_blocked ON public.filings(blocked) WHERE blocked = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.filings TO authenticated;
GRANT ALL ON public.filings TO service_role;
ALTER TABLE public.filings ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- filing_events
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.filing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_id uuid NOT NULL REFERENCES public.filings(id) ON DELETE CASCADE,
  stage public.filing_stage,
  note text,
  source public.filing_event_source NOT NULL DEFAULT 'auto',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_filing_events_filing ON public.filing_events(filing_id, occurred_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.filing_events TO authenticated;
GRANT ALL ON public.filing_events TO service_role;
ALTER TABLE public.filing_events ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- client_action_items
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.client_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  owner public.client_action_owner NOT NULL DEFAULT 'gle',
  status public.client_action_status NOT NULL DEFAULT 'open',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cai_project ON public.client_action_items(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_action_items TO authenticated;
GRANT ALL ON public.client_action_items TO service_role;
ALTER TABLE public.client_action_items ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- portal_documents
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.portal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  filing_id uuid REFERENCES public.filings(id) ON DELETE SET NULL,
  doc_type text NOT NULL,
  display_name text NOT NULL,
  storage_path text,
  external_url text,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_docs_project ON public.portal_documents(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_documents TO authenticated;
GRANT ALL ON public.portal_documents TO service_role;
ALTER TABLE public.portal_documents ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- portal_notifications
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.portal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  filing_id uuid REFERENCES public.filings(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_notif_user ON public.portal_notifications(user_id, read, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_notifications TO authenticated;
GRANT ALL ON public.portal_notifications TO service_role;
ALTER TABLE public.portal_notifications ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- RLS POLICIES
-- =========================================================================

-- client_orgs
CREATE POLICY "client_orgs: members read"
  ON public.client_orgs FOR SELECT TO authenticated
  USING (
    id IN (SELECT public.user_client_org_ids(auth.uid()))
    OR public.is_gle_staff(auth.uid())
  );
CREATE POLICY "client_orgs: gle staff write"
  ON public.client_orgs FOR ALL TO authenticated
  USING (public.is_gle_staff(auth.uid()))
  WITH CHECK (public.is_gle_staff(auth.uid()));

-- client_org_memberships
CREATE POLICY "com: self read"
  ON public.client_org_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_gle_staff(auth.uid()));
CREATE POLICY "com: gle staff write"
  ON public.client_org_memberships FOR ALL TO authenticated
  USING (public.is_gle_staff(auth.uid()))
  WITH CHECK (public.is_gle_staff(auth.uid()));

-- buildings
CREATE POLICY "buildings: org members read"
  ON public.buildings FOR SELECT TO authenticated
  USING (
    client_org_id IN (SELECT public.user_client_org_ids(auth.uid()))
    OR public.is_gle_staff(auth.uid())
  );
CREATE POLICY "buildings: gle staff write"
  ON public.buildings FOR ALL TO authenticated
  USING (public.is_gle_staff(auth.uid()))
  WITH CHECK (public.is_gle_staff(auth.uid()));

-- filings: read if user belongs to project's client_org
CREATE POLICY "filings: portal read"
  ON public.filings FOR SELECT TO authenticated
  USING (
    public.is_gle_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = filings.project_id
        AND p.client_org_id IN (SELECT public.user_client_org_ids(auth.uid()))
    )
  );
CREATE POLICY "filings: gle staff write"
  ON public.filings FOR ALL TO authenticated
  USING (public.is_gle_staff(auth.uid()))
  WITH CHECK (public.is_gle_staff(auth.uid()));

-- filing_events
CREATE POLICY "filing_events: portal read"
  ON public.filing_events FOR SELECT TO authenticated
  USING (
    public.is_gle_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.filings f
      JOIN public.projects p ON p.id = f.project_id
      WHERE f.id = filing_events.filing_id
        AND p.client_org_id IN (SELECT public.user_client_org_ids(auth.uid()))
    )
  );
CREATE POLICY "filing_events: gle staff write"
  ON public.filing_events FOR ALL TO authenticated
  USING (public.is_gle_staff(auth.uid()))
  WITH CHECK (public.is_gle_staff(auth.uid()));

-- client_action_items
CREATE POLICY "cai: portal read"
  ON public.client_action_items FOR SELECT TO authenticated
  USING (
    public.is_gle_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = client_action_items.project_id
        AND p.client_org_id IN (SELECT public.user_client_org_ids(auth.uid()))
    )
  );
CREATE POLICY "cai: gle staff write"
  ON public.client_action_items FOR ALL TO authenticated
  USING (public.is_gle_staff(auth.uid()))
  WITH CHECK (public.is_gle_staff(auth.uid()));

-- portal_documents
CREATE POLICY "portal_docs: portal read"
  ON public.portal_documents FOR SELECT TO authenticated
  USING (
    public.is_gle_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = portal_documents.project_id
        AND p.client_org_id IN (SELECT public.user_client_org_ids(auth.uid()))
    )
  );
CREATE POLICY "portal_docs: gle staff write"
  ON public.portal_documents FOR ALL TO authenticated
  USING (public.is_gle_staff(auth.uid()))
  WITH CHECK (public.is_gle_staff(auth.uid()));

-- portal_notifications: user sees own
CREATE POLICY "notif: own read"
  ON public.portal_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_gle_staff(auth.uid()));
CREATE POLICY "notif: own update"
  ON public.portal_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif: gle staff insert"
  ON public.portal_notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_gle_staff(auth.uid()));

-- =========================================================================
-- updated_at triggers
-- =========================================================================
CREATE OR REPLACE FUNCTION public.portal_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_client_orgs_updated ON public.client_orgs;
CREATE TRIGGER trg_client_orgs_updated BEFORE UPDATE ON public.client_orgs
  FOR EACH ROW EXECUTE FUNCTION public.portal_touch_updated_at();

DROP TRIGGER IF EXISTS trg_buildings_updated ON public.buildings;
CREATE TRIGGER trg_buildings_updated BEFORE UPDATE ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION public.portal_touch_updated_at();

DROP TRIGGER IF EXISTS trg_filings_updated ON public.filings;
CREATE TRIGGER trg_filings_updated BEFORE UPDATE ON public.filings
  FOR EACH ROW EXECUTE FUNCTION public.portal_touch_updated_at();

DROP TRIGGER IF EXISTS trg_cai_updated ON public.client_action_items;
CREATE TRIGGER trg_cai_updated BEFORE UPDATE ON public.client_action_items
  FOR EACH ROW EXECUTE FUNCTION public.portal_touch_updated_at();

-- =========================================================================
-- On filing stage change: record event + create notifications
-- =========================================================================
CREATE OR REPLACE FUNCTION public.filings_on_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_org_id uuid;
  v_project_name text;
  v_notif_type text;
  v_title text;
BEGIN
  SELECT p.client_org_id, p.name INTO v_client_org_id, v_project_name
  FROM public.projects p WHERE p.id = NEW.project_id;

  IF v_client_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Stage change
  IF TG_OP = 'UPDATE' AND NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN
    NEW.stage_entered_at = now();
    INSERT INTO public.filing_events (filing_id, stage, note, source)
    VALUES (NEW.id, NEW.current_stage, 'Stage changed to ' || NEW.current_stage::text, 'auto');

    IF NEW.current_stage IN ('objections', 'approved', 'permit_issued') THEN
      v_notif_type := 'filing_' || NEW.current_stage::text;
      v_title := coalesce(v_project_name,'Project') || ': ' || NEW.discipline::text || ' → ' || NEW.current_stage::text;
      INSERT INTO public.portal_notifications (user_id, project_id, filing_id, type, title, message)
      SELECT m.user_id, NEW.project_id, NEW.id, v_notif_type, v_title,
             'Filing ' || coalesce(NEW.filing_number,'') || ' is now ' || NEW.current_stage::text
      FROM public.client_org_memberships m
      WHERE m.client_org_id = v_client_org_id;
    END IF;
  END IF;

  -- Blocked transition (false → true)
  IF TG_OP = 'UPDATE' AND NEW.blocked = true AND (OLD.blocked = false OR OLD.blocked IS NULL) THEN
    NEW.blocked_since = coalesce(NEW.blocked_since, now());
    INSERT INTO public.portal_notifications (user_id, project_id, filing_id, type, title, message)
    SELECT m.user_id, NEW.project_id, NEW.id, 'filing_blocked',
           coalesce(v_project_name,'Project') || ': ' || NEW.discipline::text || ' blocked',
           coalesce(NEW.blocked_reason, 'Filing is blocked')
    FROM public.client_org_memberships m
    WHERE m.client_org_id = v_client_org_id;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_filings_on_change ON public.filings;
CREATE TRIGGER trg_filings_on_change
  BEFORE UPDATE ON public.filings
  FOR EACH ROW EXECUTE FUNCTION public.filings_on_change();

-- Client-owned action item → notification
CREATE OR REPLACE FUNCTION public.cai_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_org_id uuid;
  v_project_name text;
BEGIN
  IF NEW.owner <> 'client' THEN RETURN NEW; END IF;
  SELECT p.client_org_id, p.name INTO v_client_org_id, v_project_name
  FROM public.projects p WHERE p.id = NEW.project_id;
  IF v_client_org_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.portal_notifications (user_id, project_id, type, title, message)
  SELECT m.user_id, NEW.project_id, 'client_action_required',
         coalesce(v_project_name,'Project') || ': action needed',
         NEW.title
  FROM public.client_org_memberships m
  WHERE m.client_org_id = v_client_org_id;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_cai_on_insert ON public.client_action_items;
CREATE TRIGGER trg_cai_on_insert
  AFTER INSERT ON public.client_action_items
  FOR EACH ROW EXECUTE FUNCTION public.cai_on_insert();
