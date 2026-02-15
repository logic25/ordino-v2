-- Add partner flag to clients
ALTER TABLE public.clients ADD COLUMN is_rfp_partner boolean NOT NULL DEFAULT false;

-- Create index for quick partner lookups
CREATE INDEX idx_clients_rfp_partner ON public.clients (company_id) WHERE is_rfp_partner = true;