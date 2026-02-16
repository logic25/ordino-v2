-- Add building owner fields to projects
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS building_owner_id uuid REFERENCES public.clients(id),
  ADD COLUMN IF NOT EXISTS building_owner_name text;

-- Add index for building owner lookups
CREATE INDEX IF NOT EXISTS idx_projects_building_owner_id ON public.projects(building_owner_id);