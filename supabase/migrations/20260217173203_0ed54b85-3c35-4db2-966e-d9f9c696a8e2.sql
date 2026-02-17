
-- Update sync_pis_to_project trigger to also sync SIA and TPP fields
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
