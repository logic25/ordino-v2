
-- Create proposal_contacts table for multi-contact support
CREATE TABLE public.proposal_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id),
  name varchar NOT NULL,
  email varchar,
  phone varchar,
  company_name varchar,
  role varchar NOT NULL DEFAULT 'cc' CHECK (role IN ('bill_to', 'sign', 'cc')),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposal_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company isolation for proposal contacts"
  ON public.proposal_contacts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals p
    WHERE p.id = proposal_contacts.proposal_id
    AND is_company_member(p.company_id)
  ));

CREATE POLICY "Admins and managers can modify proposal contacts"
  ON public.proposal_contacts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM proposals p
    WHERE p.id = proposal_contacts.proposal_id
    AND is_admin_or_manager(p.company_id)
  ));

-- Update proposal number format to MMDDYY-N (sequential per day per company)
CREATE OR REPLACE FUNCTION public.generate_proposal_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
  date_str TEXT;
BEGIN
  date_str := to_char(now(), 'MMDDYY');
  
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(proposal_number, '-', 2) AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.proposals
  WHERE proposal_number LIKE date_str || '-%'
    AND company_id = NEW.company_id;
  
  NEW.proposal_number := date_str || '-' || next_num::TEXT;
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS set_proposal_number ON public.proposals;
CREATE TRIGGER set_proposal_number
  BEFORE INSERT ON public.proposals
  FOR EACH ROW
  WHEN (NEW.proposal_number IS NULL)
  EXECUTE FUNCTION public.generate_proposal_number();
