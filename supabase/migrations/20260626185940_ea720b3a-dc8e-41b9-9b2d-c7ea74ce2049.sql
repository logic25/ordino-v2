
-- Enums
CREATE TYPE public.bd_referral_stage AS ENUM
  ('ASK_MADE','INTRO_RECEIVED','MEETING_SET','PROPOSAL','WON','LOST');

CREATE TYPE public.bd_referral_source_type AS ENUM
  ('ARCHITECT','GC','OWNER','PM','OTHER');

-- Table
CREATE TABLE public.bd_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  source_label text,
  source_type public.bd_referral_source_type NOT NULL DEFAULT 'OTHER',
  referred_name text NOT NULL,
  referred_company text,
  referred_email text,
  referred_phone text,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  stage public.bd_referral_stage NOT NULL DEFAULT 'ASK_MADE',
  next_action_at date,
  next_action_note text,
  notes text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  won_value numeric,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_bd_referrals_company_active ON public.bd_referrals (company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bd_referrals_assigned ON public.bd_referrals (company_id, assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_bd_referrals_stage ON public.bd_referrals (company_id, stage) WHERE deleted_at IS NULL;
CREATE INDEX idx_bd_referrals_next_action ON public.bd_referrals (company_id, next_action_at) WHERE deleted_at IS NULL;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_referrals TO authenticated;
GRANT ALL ON public.bd_referrals TO service_role;

-- RLS
ALTER TABLE public.bd_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view bd_referrals"
  ON public.bd_referrals FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Operations can insert bd_referrals"
  ON public.bd_referrals FOR INSERT
  WITH CHECK (
    public.can_modify_operations(company_id)
    AND created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Operations can update bd_referrals"
  ON public.bd_referrals FOR UPDATE
  USING (public.can_modify_operations(company_id))
  WITH CHECK (public.can_modify_operations(company_id));

CREATE POLICY "Admins can hard-delete bd_referrals"
  ON public.bd_referrals FOR DELETE
  USING (public.is_company_admin(company_id));

-- updated_at trigger
CREATE TRIGGER update_bd_referrals_updated_at
  BEFORE UPDATE ON public.bd_referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
