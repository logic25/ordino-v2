CREATE TABLE public.bd_market_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  title text NOT NULL,
  summary text,
  source_url text,
  sender text,
  signal_date date,
  status text NOT NULL DEFAULT 'NEW',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bd_market_signals_company_created_idx
  ON public.bd_market_signals(company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_market_signals TO authenticated;
GRANT ALL ON public.bd_market_signals TO service_role;

ALTER TABLE public.bd_market_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view company market signals"
  ON public.bd_market_signals FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Members can insert company market signals"
  ON public.bd_market_signals FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Members can update company market signals"
  ON public.bd_market_signals FOR UPDATE
  TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Members can delete company market signals"
  ON public.bd_market_signals FOR DELETE
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE TRIGGER update_bd_market_signals_updated_at
  BEFORE UPDATE ON public.bd_market_signals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();