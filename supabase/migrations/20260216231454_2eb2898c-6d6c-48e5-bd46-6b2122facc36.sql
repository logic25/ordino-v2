ALTER TABLE public.proposal_items ADD COLUMN fee_type text NOT NULL DEFAULT 'fixed';
COMMENT ON COLUMN public.proposal_items.fee_type IS 'Type of fee: fixed, monthly, hourly';