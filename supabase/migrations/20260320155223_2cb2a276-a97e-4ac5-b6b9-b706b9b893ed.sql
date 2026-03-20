
CREATE OR REPLACE FUNCTION public.sync_pis_to_project()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  resp jsonb;
  cost_sum numeric := 0;
  cost_found boolean := false;
  cost_key text;
  cost_val numeric;
  proj_property_id uuid;
  pis_owner_name text;
BEGIN
  IF NEW.status = 'submitted' AND NEW.project_id IS NOT NULL 
     AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    
    resp := NEW.responses::jsonb;

    -- Aggregate per-work-type costs into estimated_job_cost
    FOR cost_key IN SELECT jsonb_object_keys(resp) LOOP
      IF cost_key LIKE '%_work_types_cost_%' THEN
        cost_val := (resp->>cost_key)::numeric;
        IF cost_val IS NOT NULL THEN
          cost_sum := cost_sum + cost_val;
          cost_found := true;
        END IF;
      END IF;
    END LOOP;

    pis_owner_name := resp->>'applicant_and_owner_owner_name';

    UPDATE public.projects SET
      gc_company_name = COALESCE(resp->>'contractors_inspections_gc_company', gc_company_name),
      gc_contact_name = COALESCE(resp->>'contractors_inspections_gc_name', gc_contact_name),
      gc_phone = COALESCE(resp->>'contractors_inspections_gc_phone', gc_phone),
      gc_email = COALESCE(resp->>'contractors_inspections_gc_email', gc_email),
      building_owner_name = COALESCE(pis_owner_name, building_owner_name),
      floor_number = COALESCE(resp->>'building_and_scope_floors', floor_number),
      unit_number = COALESCE(resp->>'building_and_scope_apt_numbers', unit_number),
      sia_name = COALESCE(resp->>'contractors_inspections_sia_name', sia_name),
      sia_company = COALESCE(resp->>'contractors_inspections_sia_company', sia_company),
      sia_phone = COALESCE(resp->>'contractors_inspections_sia_phone', sia_phone),
      sia_email = COALESCE(resp->>'contractors_inspections_sia_email', sia_email),
      sia_number = COALESCE(resp->>'contractors_inspections_sia_number', sia_number),
      sia_nys_lic = COALESCE(resp->>'contractors_inspections_sia_nys_lic', sia_nys_lic),
      tpp_name = COALESCE(resp->>'contractors_inspections_tpp_name', tpp_name),
      tpp_email = COALESCE(resp->>'contractors_inspections_tpp_email', tpp_email),
      architect_license_type = COALESCE(resp->>'applicant_and_owner_applicant_lic_type', architect_license_type),
      architect_license_number = COALESCE(resp->>'applicant_and_owner_applicant_nys_lic', architect_license_number),
      filing_type = COALESCE(resp->>'building_and_scope_filing_type', resp->>'applicant_and_owner_filing_type', filing_type),
      client_reference_number = COALESCE(resp->>'notes_client_reference_number', client_reference_number),
      estimated_job_cost = CASE WHEN cost_found THEN cost_sum ELSE COALESCE((resp->>'building_and_scope_estimated_job_cost')::numeric, estimated_job_cost) END,
      notes = CASE 
        WHEN resp->>'building_and_scope_job_description' IS NOT NULL 
        THEN COALESCE(notes || E'\n', '') || 'Job Description: ' || (resp->>'building_and_scope_job_description')
        ELSE notes
      END,
      updated_at = now()
    WHERE id = NEW.project_id
    RETURNING property_id INTO proj_property_id;

    -- Also sync owner name to the property record
    IF pis_owner_name IS NOT NULL AND proj_property_id IS NOT NULL THEN
      UPDATE public.properties SET
        owner_name = pis_owner_name,
        updated_at = now()
      WHERE id = proj_property_id
        AND (owner_name IS NULL OR owner_name = '' OR owner_name = 'UNAVAILABLE OWNER');
    END IF;
    
  END IF;
  RETURN NEW;
END;
$function$;
