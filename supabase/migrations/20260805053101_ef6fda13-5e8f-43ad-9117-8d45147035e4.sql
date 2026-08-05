ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS market_signal_id uuid
  REFERENCES public.bd_market_signals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_market_signal_id
  ON public.leads(market_signal_id)
  WHERE market_signal_id IS NOT NULL;

INSERT INTO public.changelog_entries (company_id, title, description, tag)
SELECT c.id,
       'Market signal lead capture improved',
       'Creating a lead from Market Signals now opens a pre-filled lead form and preserves the originating signal for traceability.',
       'improvement'
FROM public.companies c
ORDER BY c.created_at NULLS LAST
LIMIT 1;