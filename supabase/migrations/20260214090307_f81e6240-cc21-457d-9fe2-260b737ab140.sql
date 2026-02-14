
-- Retainer accounts per client
CREATE TABLE public.client_retainers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  original_amount NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'refunded', 'cancelled')),
  notes TEXT,
  qbo_credit_memo_id VARCHAR,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ledger of deposits and draw-downs
CREATE TABLE public.retainer_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  retainer_id UUID NOT NULL REFERENCES public.client_retainers(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id),
  type TEXT NOT NULL CHECK (type IN ('deposit', 'draw_down', 'refund', 'adjustment')),
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  description TEXT,
  performed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add retainer_id to invoices for linking
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS retainer_id UUID REFERENCES public.client_retainers(id);

-- Indexes
CREATE INDEX idx_client_retainers_client ON public.client_retainers(client_id);
CREATE INDEX idx_client_retainers_company ON public.client_retainers(company_id);
CREATE INDEX idx_client_retainers_status ON public.client_retainers(status);
CREATE INDEX idx_retainer_transactions_retainer ON public.retainer_transactions(retainer_id);
CREATE INDEX idx_retainer_transactions_invoice ON public.retainer_transactions(invoice_id);

-- RLS
ALTER TABLE public.client_retainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retainer_transactions ENABLE ROW LEVEL SECURITY;

-- client_retainers policies
CREATE POLICY "Company members can view retainers"
  ON public.client_retainers FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Admins and managers can manage retainers"
  ON public.client_retainers FOR ALL
  USING (is_admin_or_manager(company_id))
  WITH CHECK (is_admin_or_manager(company_id));

-- retainer_transactions policies
CREATE POLICY "Company members can view retainer transactions"
  ON public.retainer_transactions FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Admins and managers can manage retainer transactions"
  ON public.retainer_transactions FOR ALL
  USING (is_admin_or_manager(company_id))
  WITH CHECK (is_admin_or_manager(company_id));

-- Updated_at trigger
CREATE TRIGGER update_client_retainers_updated_at
  BEFORE UPDATE ON public.client_retainers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
