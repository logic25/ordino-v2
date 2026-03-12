
CREATE OR REPLACE FUNCTION public.get_public_rfi(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rfi_row record;
  result jsonb;
  prop_json jsonb;
  proj_json jsonb;
  property_json jsonb;
  plan_names text[];
  work_types_json jsonb;
BEGIN
  SELECT * INTO rfi_row FROM public.rfi_requests
  WHERE access_token = _token::uuid
    AND status IN ('draft', 'sent', 'submitted');
  IF NOT FOUND THEN RETURN NULL; END IF;

  result := to_jsonb(rfi_row);

  IF rfi_row.property_id IS NOT NULL THEN
    SELECT jsonb_build_object('address', pr.address, 'borough', pr.borough, 'block', pr.block, 'lot', pr.lot, 'owner_name', pr.owner_name)
    INTO property_json FROM public.properties pr WHERE pr.id = rfi_row.property_id;
  END IF;

  IF rfi_row.project_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'name', pj.name, 'building_owner_name', pj.building_owner_name,
      'unit_number', pj.unit_number, 'client_id', pj.client_id,
      'property_id', pj.property_id,
      'gc_company_name', pj.gc_company_name, 'gc_contact_name', pj.gc_contact_name,
      'gc_phone', pj.gc_phone, 'gc_email', pj.gc_email,
      'architect_company_name', pj.architect_company_name,
      'architect_contact_name', pj.architect_contact_name,
      'architect_phone', pj.architect_phone, 'architect_email', pj.architect_email,
      'architect_license_type', pj.architect_license_type,
      'architect_license_number', pj.architect_license_number,
      'sia_name', pj.sia_name, 'sia_company', pj.sia_company,
      'sia_phone', pj.sia_phone, 'sia_email', pj.sia_email,
      'tpp_name', pj.tpp_name, 'tpp_email', pj.tpp_email
    ) INTO proj_json FROM public.projects pj WHERE pj.id = rfi_row.project_id;

    IF property_json IS NULL THEN
      SELECT jsonb_build_object('address', pr.address, 'borough', pr.borough, 'block', pr.block, 'lot', pr.lot, 'owner_name', pr.owner_name)
      INTO property_json FROM public.properties pr
      WHERE pr.id = (SELECT property_id FROM public.projects WHERE id = rfi_row.project_id);
    END IF;
  END IF;

  IF rfi_row.proposal_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'title', pp.title, 'property_id', pp.property_id,
      'architect_name', pp.architect_name, 'architect_company', pp.architect_company,
      'architect_phone', pp.architect_phone, 'architect_email', pp.architect_email,
      'architect_license_type', pp.architect_license_type,
      'architect_license_number', pp.architect_license_number,
      'gc_name', pp.gc_name, 'gc_company', pp.gc_company,
      'gc_phone', pp.gc_phone, 'gc_email', pp.gc_email,
      'sia_name', pp.sia_name, 'sia_company', pp.sia_company,
      'sia_phone', pp.sia_phone, 'sia_email', pp.sia_email,
      'tpp_name', pp.tpp_name, 'tpp_email', pp.tpp_email,
      'job_description', pp.job_description, 'unit_number', pp.unit_number
    ) INTO prop_json FROM public.proposals pp WHERE pp.id = rfi_row.proposal_id;

    IF property_json IS NULL AND prop_json->>'property_id' IS NOT NULL THEN
      SELECT jsonb_build_object('address', pr.address, 'borough', pr.borough, 'block', pr.block, 'lot', pr.lot, 'owner_name', pr.owner_name)
      INTO property_json FROM public.properties pr
      WHERE pr.id = (prop_json->>'property_id')::uuid;
    END IF;

    SELECT COALESCE(jsonb_agg(DISTINCT d.val), '[]'::jsonb)
    INTO work_types_json
    FROM public.proposal_items pi,
         LATERAL jsonb_array_elements_text(to_jsonb(pi.disciplines)) AS d(val)
    WHERE pi.proposal_id = rfi_row.proposal_id
      AND (pi.is_optional IS NULL OR pi.is_optional = false)
      AND pi.disciplines IS NOT NULL;
  END IF;

  plan_names := get_rfi_plan_filenames(_token);

  result := result || jsonb_build_object(
    'resolved_property', property_json,
    'project_data', proj_json,
    'proposal_data', prop_json,
    'plan_filenames', to_jsonb(plan_names),
    'proposal_work_types', COALESCE(work_types_json, '[]'::jsonb)
  );

  RETURN result;
END;
$function$;
