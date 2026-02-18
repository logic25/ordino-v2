
-- 1. New table: project_checklist_items
CREATE TABLE public.project_checklist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'missing_document',
  from_whom text,
  source_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  source_catalog_name text,
  status text NOT NULL DEFAULT 'open',
  requested_date timestamptz DEFAULT now(),
  completed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_checklist_items_project ON public.project_checklist_items(project_id);
CREATE INDEX idx_checklist_items_company ON public.project_checklist_items(company_id);
CREATE INDEX idx_checklist_items_status ON public.project_checklist_items(status);

-- Enable RLS
ALTER TABLE public.project_checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company members can view checklist items"
  ON public.project_checklist_items FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can create checklist items"
  ON public.project_checklist_items FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update checklist items"
  ON public.project_checklist_items FOR UPDATE
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can delete checklist items"
  ON public.project_checklist_items FOR DELETE
  USING (public.is_company_member(company_id));

-- Updated_at trigger
CREATE TRIGGER update_project_checklist_items_updated_at
  BEFORE UPDATE ON public.project_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. New columns on projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS filing_type text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_reference_number text;

-- 3. Update sync_pis_to_project() trigger to map new fields
CREATE OR REPLACE FUNCTION public.sync_pis_to_project()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  resp jsonb;
BEGIN
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
      -- SIA fields
      sia_name = COALESCE(resp->>'contractors_inspections_sia_name', sia_name),
      sia_company = COALESCE(resp->>'contractors_inspections_sia_company', sia_company),
      sia_phone = COALESCE(resp->>'contractors_inspections_sia_phone', sia_phone),
      sia_email = COALESCE(resp->>'contractors_inspections_sia_email', sia_email),
      sia_number = COALESCE(resp->>'contractors_inspections_sia_number', sia_number),
      sia_nys_lic = COALESCE(resp->>'contractors_inspections_sia_nys_lic', sia_nys_lic),
      -- TPP fields
      tpp_name = COALESCE(resp->>'contractors_inspections_tpp_name', tpp_name),
      tpp_email = COALESCE(resp->>'contractors_inspections_tpp_email', tpp_email),
      -- Architect license info
      architect_license_type = COALESCE(resp->>'applicant_and_owner_applicant_lic_type', architect_license_type),
      architect_license_number = COALESCE(resp->>'applicant_and_owner_applicant_nys_lic', architect_license_number),
      -- NEW: filing type and client reference number
      filing_type = COALESCE(resp->>'applicant_and_owner_filing_type', filing_type),
      client_reference_number = COALESCE(resp->>'notes_client_reference_number', client_reference_number),
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
$function$;
