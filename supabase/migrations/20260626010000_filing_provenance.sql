-- Filing provenance + managed DOB account list (re-architecture Change 3).
--
-- Goal: every filing records HOW it was done — which DOB NOW account it went
-- under, the applicant entity, who filed it, when, and the resulting job number
-- — as structured data, so this knowledge never lives only in one person's head.
--
-- SECURITY: this stores account LABEL / IDENTIFIER only (e.g. a login email) and
-- an OPTIONAL reference (handle) to a secret held in an external vault
-- (1Password / Supabase Vault). It NEVER stores passwords. The vault_secret_ref
-- is just a pointer the agent resolves server-side at fill time.

-- ─── Managed list of DOB NOW accounts the firm files under ───
CREATE TABLE IF NOT EXISTS public.dob_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL,                 -- human label, e.g. "Green Light — info@"
  identifier text NOT NULL,            -- login identifier (email/username) — NOT a secret
  vault_secret_ref text,               -- pointer to the password in 1Password / Supabase Vault — NEVER the password
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.dob_accounts.vault_secret_ref IS
  'Reference/handle to a secret in an external vault (1Password/Supabase Vault). Never store the password itself here.';

ALTER TABLE public.dob_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can read dob_accounts"
  ON public.dob_accounts FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can manage dob_accounts"
  ON public.dob_accounts FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER update_dob_accounts_updated_at
  BEFORE UPDATE ON public.dob_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Provenance fields on each filing run ───
ALTER TABLE public.filing_runs
  ADD COLUMN IF NOT EXISTS dob_account_id uuid REFERENCES public.dob_accounts(id),
  ADD COLUMN IF NOT EXISTS dob_account_used text,        -- denormalized label, survives account deletion
  ADD COLUMN IF NOT EXISTS applicant_entity text,        -- entity/applicant of record
  ADD COLUMN IF NOT EXISTS filed_by text,                -- 'agent' or a profile id
  ADD COLUMN IF NOT EXISTS filed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dob_job_number text,          -- captured after fill
  ADD COLUMN IF NOT EXISTS confirmation_status text,
  ADD COLUMN IF NOT EXISTS browserbase_session_url text;

COMMENT ON COLUMN public.filing_runs.dob_account_used IS
  'Which DOB NOW account this filing was filed under — visible to anyone without contacting the filer.';

CREATE INDEX IF NOT EXISTS idx_filing_runs_dob_account ON public.filing_runs(dob_account_id);
