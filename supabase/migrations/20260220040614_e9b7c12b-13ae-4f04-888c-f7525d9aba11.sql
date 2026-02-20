
-- Add onboarding_completed to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Create co_status enum
DO $$ BEGIN
  CREATE TYPE public.co_status AS ENUM ('draft', 'pending_internal', 'pending_client', 'approved', 'rejected', 'voided');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create change_orders table
CREATE TABLE IF NOT EXISTS public.change_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  co_number text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text,
  reason text,
  amount numeric NOT NULL DEFAULT 0,
  status public.co_status NOT NULL DEFAULT 'draft',
  requested_by text,
  linked_service_names text[] DEFAULT '{}',
  internal_signed_at timestamptz,
  internal_signed_by uuid REFERENCES public.profiles(id),
  internal_signature_data text,
  client_signed_at timestamptz,
  client_signer_name text,
  client_signature_data text,
  sent_at timestamptz,
  approved_at timestamptz,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-number trigger
CREATE OR REPLACE FUNCTION public.generate_co_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN co_number ~ '^CO#[0-9]+$'
      THEN CAST(SUBSTRING(co_number FROM 4) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM public.change_orders
  WHERE project_id = NEW.project_id;

  NEW.co_number := 'CO#' || next_num;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_co_number
  BEFORE INSERT ON public.change_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_co_number();

-- Updated_at trigger
CREATE TRIGGER update_change_orders_updated_at
  BEFORE UPDATE ON public.change_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "change_orders_select" ON public.change_orders
  FOR SELECT USING (public.is_company_member(company_id));

CREATE POLICY "change_orders_insert" ON public.change_orders
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "change_orders_update" ON public.change_orders
  FOR UPDATE USING (public.is_company_member(company_id));

CREATE POLICY "change_orders_delete" ON public.change_orders
  FOR DELETE USING (public.is_company_member(company_id));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_change_orders_project_id ON public.change_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_company_id ON public.change_orders(company_id);
