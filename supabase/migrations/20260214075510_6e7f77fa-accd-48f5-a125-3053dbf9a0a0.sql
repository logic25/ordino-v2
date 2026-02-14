-- Add parent_invoice_id to invoices for payment plan child invoices
ALTER TABLE public.invoices
ADD COLUMN parent_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Index for fast lookups
CREATE INDEX idx_invoices_parent_id ON public.invoices(parent_invoice_id) WHERE parent_invoice_id IS NOT NULL;

-- RLS already covers invoices via company_id, no new policies needed