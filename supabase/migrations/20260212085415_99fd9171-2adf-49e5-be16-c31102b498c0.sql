
-- Create project status enum
CREATE TYPE public.project_status AS ENUM ('open', 'on_hold', 'closed', 'paid');

-- Create projects table with all legacy fields
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  property_id UUID NOT NULL REFERENCES public.properties(id),
  proposal_id UUID REFERENCES public.proposals(id),
  
  -- Core info
  name TEXT,
  project_number VARCHAR,
  project_type VARCHAR,
  floor_number VARCHAR,
  status public.project_status NOT NULL DEFAULT 'open',
  
  -- People
  assigned_pm_id UUID REFERENCES public.profiles(id),
  senior_pm_id UUID REFERENCES public.profiles(id),
  client_id UUID REFERENCES public.clients(id),
  
  -- Flags
  is_external BOOLEAN NOT NULL DEFAULT false,
  notable BOOLEAN NOT NULL DEFAULT false,
  
  -- Dates
  completion_date DATE,
  
  -- Audit
  created_by UUID REFERENCES public.profiles(id),
  last_editor_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-generate project number
CREATE OR REPLACE FUNCTION public.generate_project_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_num INTEGER;
  year_str TEXT;
BEGIN
  year_str := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(project_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.projects
  WHERE project_number LIKE 'PJ' || year_str || '-%'
    AND company_id = NEW.company_id;
  
  NEW.project_number := 'PJ' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_project_number
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  WHEN (NEW.project_number IS NULL)
  EXECUTE FUNCTION public.generate_project_number();

-- Updated_at trigger
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Company isolation for projects"
  ON public.projects FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Admins and managers can modify projects"
  ON public.projects FOR ALL
  USING (is_admin_or_manager(company_id));

-- Add project_id FK to dob_applications so applications live under projects
ALTER TABLE public.dob_applications
  ADD COLUMN project_id UUID REFERENCES public.projects(id);

-- Add project_id FK to services so services can be linked to projects
ALTER TABLE public.services
  ADD COLUMN project_id UUID REFERENCES public.projects(id);

-- Update proposals table: add converted_project_id
ALTER TABLE public.proposals
  ADD COLUMN converted_project_id UUID REFERENCES public.projects(id);
