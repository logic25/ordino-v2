
-- Add project_id column to universal_documents for linking docs to projects
ALTER TABLE public.universal_documents ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.universal_documents ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id);

-- Create index for project lookups
CREATE INDEX IF NOT EXISTS idx_universal_documents_project_id ON public.universal_documents(project_id);

-- Create trigger function to sync PIS responses back to the project
CREATE OR REPLACE FUNCTION public.sync_pis_to_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  resp jsonb;
BEGIN
  -- Only fire when status changes to 'submitted' and project_id is set
  IF NEW.status = 'submitted' AND NEW.project_id IS NOT NULL 
     AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    
    resp := NEW.responses::jsonb;

    UPDATE public.projects SET
      -- GC fields
      gc_company_name = COALESCE(resp->>'contractors_inspections_gc_company', gc_company_name),
      gc_contact_name = COALESCE(resp->>'contractors_inspections_gc_name', gc_contact_name),
      gc_phone = COALESCE(resp->>'contractors_inspections_gc_phone', gc_phone),
      gc_email = COALESCE(resp->>'contractors_inspections_gc_email', gc_email),
      -- Building owner fields  
      building_owner_name = COALESCE(resp->>'applicant_and_owner_owner_name', building_owner_name),
      -- Floor/unit
      floor_number = COALESCE(resp->>'building_and_scope_floors', floor_number),
      unit_number = COALESCE(resp->>'building_and_scope_apt_numbers', unit_number),
      -- Notes: append job description
      notes = CASE 
        WHEN resp->>'building_and_scope_job_description' IS NOT NULL 
        THEN COALESCE(notes || E'\n', '') || 'Job Description: ' || (resp->>'building_and_scope_job_description')
        ELSE notes
      END,
      updated_at = now()
    WHERE id = NEW.project_id;
    
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to rfi_requests
DROP TRIGGER IF EXISTS trg_sync_pis_to_project ON public.rfi_requests;
CREATE TRIGGER trg_sync_pis_to_project
  AFTER UPDATE ON public.rfi_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pis_to_project();
