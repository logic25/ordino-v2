-- Create clients table for managing client contacts
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name varchar NOT NULL,
  email varchar,
  phone varchar,
  address text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company isolation for clients"
  ON public.clients FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Admins and managers can modify clients"
  ON public.clients FOR ALL
  USING (is_admin_or_manager(company_id));

-- Add new columns to proposal_items for enhanced service tracking
ALTER TABLE public.proposal_items 
  ADD COLUMN IF NOT EXISTS estimated_hours numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;

-- Update proposals table: add client_id reference and terms_conditions
ALTER TABLE public.proposals 
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS terms_conditions text;

-- Add service_catalog and default_terms to companies settings (these will be stored in the settings jsonb column)
-- No schema change needed, just documentation that companies.settings will contain:
-- { "service_catalog": [...], "default_terms": "..." }

-- Create trigger for clients updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster client lookups
CREATE INDEX idx_clients_company_id ON public.clients(company_id);
CREATE INDEX idx_clients_name ON public.clients(name);
CREATE INDEX idx_proposals_client_id ON public.proposals(client_id);