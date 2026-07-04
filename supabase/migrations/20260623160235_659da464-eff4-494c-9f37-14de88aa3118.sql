
-- 1) Proposals: optional per-proposal interest overrides
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS late_interest_rate_apr numeric(5,2) NULL,
  ADD COLUMN IF NOT EXISTS interest_grace_days integer NULL,
  ADD COLUMN IF NOT EXISTS interest_compounding text NULL
    CHECK (interest_compounding IS NULL OR interest_compounding IN ('simple','monthly'));

-- 2) Certified-mail tracking
CREATE TABLE IF NOT EXISTS public.invoice_certified_mailings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  demand_letter_activity_id uuid NULL REFERENCES public.invoice_activity_log(id) ON DELETE SET NULL,
  usps_tracking_number text NOT NULL,
  mailed_date date NOT NULL DEFAULT CURRENT_DATE,
  delivered_date date NULL,
  return_receipt_storage_path text NULL,
  notes text NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_certmail_invoice ON public.invoice_certified_mailings(invoice_id);
CREATE INDEX IF NOT EXISTS idx_certmail_company ON public.invoice_certified_mailings(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_certified_mailings TO authenticated;
GRANT ALL ON public.invoice_certified_mailings TO service_role;
ALTER TABLE public.invoice_certified_mailings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "certmail_company_select" ON public.invoice_certified_mailings
  FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "certmail_company_insert" ON public.invoice_certified_mailings
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "certmail_company_update" ON public.invoice_certified_mailings
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "certmail_company_delete" ON public.invoice_certified_mailings
  FOR DELETE TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE TRIGGER trg_certmail_updated_at
  BEFORE UPDATE ON public.invoice_certified_mailings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Interest snapshots
CREATE TABLE IF NOT EXISTS public.invoice_interest_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  as_of_date date NOT NULL DEFAULT CURRENT_DATE,
  principal numeric(14,2) NOT NULL,
  rate_apr numeric(5,2) NOT NULL,
  days_overdue_for_interest integer NOT NULL,
  accrued_interest numeric(14,2) NOT NULL,
  source text NOT NULL CHECK (source IN ('demand_letter','payment','manual')),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interest_snap_invoice ON public.invoice_interest_snapshots(invoice_id, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_interest_snap_company ON public.invoice_interest_snapshots(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_interest_snapshots TO authenticated;
GRANT ALL ON public.invoice_interest_snapshots TO service_role;
ALTER TABLE public.invoice_interest_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interest_snap_company_select" ON public.invoice_interest_snapshots
  FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "interest_snap_company_insert" ON public.invoice_interest_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "interest_snap_company_update" ON public.invoice_interest_snapshots
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "interest_snap_company_delete" ON public.invoice_interest_snapshots
  FOR DELETE TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- 4) View: invoice balances with computed accrued interest
-- Honors company-wide master toggle (companies.settings->>'late_interest_enabled')
-- AND interest_clause_effective_from. Falls back to NULL/0 when disabled.
CREATE OR REPLACE VIEW public.invoice_balances_with_interest
WITH (security_invoker = true)
AS
SELECT
  i.id AS invoice_id,
  i.company_id,
  i.total_due AS principal,
  COALESCE(
    p.late_interest_rate_apr,
    NULLIF((c.settings->>'default_late_interest_rate_apr')::numeric, 0)
  ) AS interest_rate_apr,
  (i.due_date + COALESCE(p.interest_grace_days, COALESCE((c.settings->>'default_interest_grace_days')::int, 0)) * INTERVAL '1 day')::date AS interest_start_date,
  CASE
    WHEN COALESCE((c.settings->>'late_interest_enabled')::boolean, false) = false THEN 0::numeric
    WHEN p.client_signed_at IS NULL THEN 0::numeric
    WHEN c.settings ? 'interest_clause_effective_from'
         AND p.client_signed_at::date < (c.settings->>'interest_clause_effective_from')::date THEN 0::numeric
    WHEN i.due_date IS NULL THEN 0::numeric
    WHEN i.status = 'paid' THEN 0::numeric
    WHEN COALESCE(
           p.late_interest_rate_apr,
           (c.settings->>'default_late_interest_rate_apr')::numeric
         ) IS NULL THEN 0::numeric
    ELSE GREATEST(
      0,
      ROUND(
        i.total_due
        * (COALESCE(p.late_interest_rate_apr, (c.settings->>'default_late_interest_rate_apr')::numeric) / 100.0)
        * (
            GREATEST(
              0,
              (CURRENT_DATE - (i.due_date + COALESCE(p.interest_grace_days, COALESCE((c.settings->>'default_interest_grace_days')::int, 0)) * INTERVAL '1 day')::date)
            )::numeric / 365.0
          ),
        2
      )
    )
  END AS accrued_interest_to_date
FROM public.invoices i
LEFT JOIN public.companies c ON c.id = i.company_id
LEFT JOIN public.projects proj ON proj.id = i.project_id
LEFT JOIN public.proposals p ON p.id = proj.proposal_id;

GRANT SELECT ON public.invoice_balances_with_interest TO authenticated;
GRANT SELECT ON public.invoice_balances_with_interest TO service_role;
