
-- =========================================================================
-- BD Module — Sprint 1: Schema rails
-- =========================================================================

-- ---------- ENUMS ----------
CREATE TYPE public.bd_lead_source_type AS ENUM ('EVENT','REFERRAL','PHONE','EMAIL','WEBSITE','GOOGLE','COLD','OTHER');
CREATE TYPE public.bd_lead_stage AS ENUM ('NEW','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST');
CREATE TYPE public.bd_lead_timeline AS ENUM ('IMMEDIATE','MONTHS_1_3','MONTHS_3_6','MONTHS_6_PLUS','UNKNOWN');
CREATE TYPE public.bd_event_priority AS ENUM ('GO','DISCUSS','SKIP');
CREATE TYPE public.bd_event_status AS ENUM ('PENDING_APPROVAL','APPROVED','REGISTERED','ATTENDED','SKIPPED','CANCELLED');
CREATE TYPE public.bd_price_verified AS ENUM ('VERIFIED','UNVERIFIED','PARTIALLY');
CREATE TYPE public.bd_membership_status AS ENUM ('ACTIVE','EXPIRED','NOT_MEMBER','EVALUATING');
CREATE TYPE public.bd_check_frequency AS ENUM ('WEEKLY','BI_WEEKLY','MONTHLY','QUARTERLY');
CREATE TYPE public.bd_source_priority AS ENUM ('HIGH','MED','LOW');
CREATE TYPE public.bd_activity_type AS ENUM ('NOTE','EMAIL','CALL','MEETING','STAGE_CHANGE','STATUS_CHANGE','SYSTEM','PROPOSAL_CREATED','APPROVAL');
CREATE TYPE public.bd_sequence_status AS ENUM ('ACTIVE','PAUSED','COMPLETED','EXITED');

-- ---------- bd_memberships ----------
CREATE TABLE public.bd_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  organization text NOT NULL,
  status public.bd_membership_status NOT NULL DEFAULT 'EVALUATING',
  annual_cost numeric(12,2),
  member_since date,
  next_renewal date,
  login_username text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_memberships TO authenticated;
GRANT ALL ON public.bd_memberships TO service_role;
ALTER TABLE public.bd_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage bd_memberships" ON public.bd_memberships
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER update_bd_memberships_updated_at BEFORE UPDATE ON public.bd_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_bd_memberships_company ON public.bd_memberships(company_id);

-- ---------- bd_events ----------
CREATE TABLE public.bd_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date,
  end_date date,
  start_time time,
  end_time time,
  location text,
  source_url text,
  category text,
  priority public.bd_event_priority,
  status public.bd_event_status NOT NULL DEFAULT 'PENDING_APPROVAL',
  cost_low numeric(12,2),
  cost_high numeric(12,2),
  cost_member numeric(12,2),
  cost_nonmember numeric(12,2),
  cost_actual numeric(12,2),
  included_in_membership boolean NOT NULL DEFAULT false,
  membership_id uuid REFERENCES public.bd_memberships(id) ON DELETE SET NULL,
  price_verified public.bd_price_verified DEFAULT 'UNVERIFIED',
  proposed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  paid_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  next_action text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_events TO authenticated;
GRANT ALL ON public.bd_events TO service_role;
ALTER TABLE public.bd_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage bd_events" ON public.bd_events
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER update_bd_events_updated_at BEFORE UPDATE ON public.bd_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_bd_events_company ON public.bd_events(company_id);
CREATE INDEX idx_bd_events_status ON public.bd_events(company_id, status);
CREATE INDEX idx_bd_events_start_date ON public.bd_events(company_id, start_date);

-- ---------- bd_event_attendees ----------
CREATE TABLE public.bd_event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.bd_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rsvp_status text,
  attended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_event_attendees TO authenticated;
GRANT ALL ON public.bd_event_attendees TO service_role;
ALTER TABLE public.bd_event_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage bd_event_attendees" ON public.bd_event_attendees
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER update_bd_event_attendees_updated_at BEFORE UPDATE ON public.bd_event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_bd_event_attendees_event ON public.bd_event_attendees(event_id);
CREATE INDEX idx_bd_event_attendees_user ON public.bd_event_attendees(user_id);

-- ---------- bd_event_sources ----------
CREATE TABLE public.bd_event_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  check_frequency public.bd_check_frequency NOT NULL DEFAULT 'WEEKLY',
  priority public.bd_source_priority NOT NULL DEFAULT 'MED',
  last_checked_at timestamptz,
  last_checked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_event_sources TO authenticated;
GRANT ALL ON public.bd_event_sources TO service_role;
ALTER TABLE public.bd_event_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage bd_event_sources" ON public.bd_event_sources
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER update_bd_event_sources_updated_at BEFORE UPDATE ON public.bd_event_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_bd_event_sources_company ON public.bd_event_sources(company_id);

-- ---------- bd_sequences ----------
CREATE TABLE public.bd_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  target_persona text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_sequences TO authenticated;
GRANT ALL ON public.bd_sequences TO service_role;
ALTER TABLE public.bd_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage bd_sequences" ON public.bd_sequences
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER update_bd_sequences_updated_at BEFORE UPDATE ON public.bd_sequences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_bd_sequences_company ON public.bd_sequences(company_id);

-- ---------- bd_sequence_steps ----------
CREATE TABLE public.bd_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES public.bd_sequences(id) ON DELETE CASCADE,
  step_number int NOT NULL,
  day_offset int NOT NULL DEFAULT 0,
  subject text,
  body_template text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (sequence_id, step_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_sequence_steps TO authenticated;
GRANT ALL ON public.bd_sequence_steps TO service_role;
ALTER TABLE public.bd_sequence_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage bd_sequence_steps" ON public.bd_sequence_steps
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER update_bd_sequence_steps_updated_at BEFORE UPDATE ON public.bd_sequence_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_bd_sequence_steps_sequence ON public.bd_sequence_steps(sequence_id);

-- ---------- ALTER client_contacts ----------
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS is_referrer boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_client_contacts_is_referrer ON public.client_contacts(company_id, is_referrer) WHERE is_referrer = true;

-- ---------- ALTER leads (additive only) ----------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source_type public.bd_lead_source_type,
  ADD COLUMN IF NOT EXISTS stage public.bd_lead_stage,
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.bd_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_by_contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_timeline public.bd_lead_timeline,
  ADD COLUMN IF NOT EXISTS hot_opportunity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expected_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS business_card_photo_url text;

CREATE INDEX IF NOT EXISTS idx_leads_event ON public.leads(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_referred_by_contact ON public.leads(referred_by_contact_id) WHERE referred_by_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads(company_id, stage) WHERE stage IS NOT NULL;

-- Deferred validation trigger: only enforced when source_type is non-null.
-- This lets legacy rows (and the old Proposals capture modal) keep working untouched.
CREATE OR REPLACE FUNCTION public.bd_validate_lead_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_type IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.source_type = 'EVENT' AND NEW.event_id IS NULL THEN
    RAISE EXCEPTION 'event_id is required when source_type = EVENT';
  END IF;
  IF NEW.source_type = 'REFERRAL' AND NEW.referred_by_contact_id IS NULL THEN
    RAISE EXCEPTION 'referred_by_contact_id is required when source_type = REFERRAL';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bd_validate_lead_source_trg ON public.leads;
CREATE TRIGGER bd_validate_lead_source_trg
  BEFORE INSERT OR UPDATE OF source_type, event_id, referred_by_contact_id
  ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.bd_validate_lead_source();

-- ---------- bd_sequence_enrollments (after leads FK exists) ----------
CREATE TABLE public.bd_sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES public.bd_sequences(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  current_step int NOT NULL DEFAULT 0,
  status public.bd_sequence_status NOT NULL DEFAULT 'ACTIVE',
  last_sent_at timestamptz,
  paused_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (sequence_id, lead_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_sequence_enrollments TO authenticated;
GRANT ALL ON public.bd_sequence_enrollments TO service_role;
ALTER TABLE public.bd_sequence_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage bd_sequence_enrollments" ON public.bd_sequence_enrollments
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER update_bd_sequence_enrollments_updated_at BEFORE UPDATE ON public.bd_sequence_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_bd_sequence_enrollments_lead ON public.bd_sequence_enrollments(lead_id);
CREATE INDEX idx_bd_sequence_enrollments_sequence ON public.bd_sequence_enrollments(sequence_id);

-- ---------- bd_activities (shared Lead + Event timeline) ----------
CREATE TABLE public.bd_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.bd_events(id) ON DELETE CASCADE,
  type public.bd_activity_type NOT NULL,
  content text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT bd_activities_exactly_one_parent CHECK ((lead_id IS NULL) <> (event_id IS NULL))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_activities TO authenticated;
GRANT ALL ON public.bd_activities TO service_role;
ALTER TABLE public.bd_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage bd_activities" ON public.bd_activities
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER update_bd_activities_updated_at BEFORE UPDATE ON public.bd_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_bd_activities_lead ON public.bd_activities(lead_id, created_at DESC) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_bd_activities_event ON public.bd_activities(event_id, created_at DESC) WHERE event_id IS NOT NULL;
CREATE INDEX idx_bd_activities_company ON public.bd_activities(company_id, created_at DESC);
