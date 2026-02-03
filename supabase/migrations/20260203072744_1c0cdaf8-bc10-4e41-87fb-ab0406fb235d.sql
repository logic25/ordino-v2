-- Create proposal status enum
CREATE TYPE proposal_status AS ENUM (
  'draft',
  'sent',
  'viewed',
  'signed_internal',
  'signed_client',
  'accepted',
  'rejected',
  'expired'
);

-- Create proposals table
CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  
  -- Proposal details
  proposal_number VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  scope_of_work TEXT,
  
  -- Payment terms
  payment_terms TEXT,
  deposit_required NUMERIC(12,2) DEFAULT 0,
  deposit_percentage NUMERIC(5,2),
  
  -- Totals
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  
  -- Status and dates
  status proposal_status DEFAULT 'draft',
  valid_until DATE,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  
  -- Internal signature
  internal_signed_by UUID REFERENCES public.profiles(id),
  internal_signed_at TIMESTAMPTZ,
  internal_signature_data TEXT,
  assigned_pm_id UUID REFERENCES public.profiles(id),
  
  -- Client signature
  client_name VARCHAR(255),
  client_email VARCHAR(255),
  client_signed_at TIMESTAMPTZ,
  client_signature_data TEXT,
  client_ip_address VARCHAR(45),
  
  -- Converted project reference
  converted_application_id UUID REFERENCES public.dob_applications(id),
  converted_at TIMESTAMPTZ,
  
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create proposal line items table (services)
CREATE TABLE public.proposal_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  total_price NUMERIC(12,2) DEFAULT 0,
  
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create proposal payment milestones table
CREATE TABLE public.proposal_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  percentage NUMERIC(5,2),
  amount NUMERIC(12,2),
  due_date DATE,
  
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_milestones ENABLE ROW LEVEL SECURITY;

-- RLS policies for proposals
CREATE POLICY "Company isolation for proposals"
  ON public.proposals FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Admins and managers can modify proposals"
  ON public.proposals FOR ALL
  USING (is_admin_or_manager(company_id));

-- RLS policies for proposal_items (inherit from proposal)
CREATE POLICY "Company isolation for proposal items"
  ON public.proposal_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.proposals p 
    WHERE p.id = proposal_id AND is_company_member(p.company_id)
  ));

CREATE POLICY "Admins and managers can modify proposal items"
  ON public.proposal_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.proposals p 
    WHERE p.id = proposal_id AND is_admin_or_manager(p.company_id)
  ));

-- RLS policies for proposal_milestones (inherit from proposal)
CREATE POLICY "Company isolation for proposal milestones"
  ON public.proposal_milestones FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.proposals p 
    WHERE p.id = proposal_id AND is_company_member(p.company_id)
  ));

CREATE POLICY "Admins and managers can modify proposal milestones"
  ON public.proposal_milestones FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.proposals p 
    WHERE p.id = proposal_id AND is_admin_or_manager(p.company_id)
  ));

-- Create indexes for performance
CREATE INDEX idx_proposals_company_id ON public.proposals(company_id);
CREATE INDEX idx_proposals_property_id ON public.proposals(property_id);
CREATE INDEX idx_proposals_status ON public.proposals(status);
CREATE INDEX idx_proposal_items_proposal_id ON public.proposal_items(proposal_id);
CREATE INDEX idx_proposal_milestones_proposal_id ON public.proposal_milestones(proposal_id);

-- Add triggers for updated_at
CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate proposal number
CREATE OR REPLACE FUNCTION public.generate_proposal_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  year_str TEXT;
BEGIN
  year_str := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(proposal_number FROM 6) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.proposals
  WHERE proposal_number LIKE 'P' || year_str || '-%'
    AND company_id = NEW.company_id;
  
  NEW.proposal_number := 'P' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_proposal_number
  BEFORE INSERT ON public.proposals
  FOR EACH ROW
  WHEN (NEW.proposal_number IS NULL)
  EXECUTE FUNCTION public.generate_proposal_number();