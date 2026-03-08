
DROP FUNCTION public.submit_rfi_response(text, jsonb, text);

CREATE OR REPLACE FUNCTION public.submit_rfi_response(
  _token text,
  _responses jsonb,
  _status text DEFAULT 'submitted'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rfi_row record;
  proj record;
  prop_address text;
BEGIN
  UPDATE public.rfi_requests SET
    responses = _responses,
    submitted_at = CASE WHEN _status = 'submitted' THEN COALESCE(submitted_at, now()) ELSE submitted_at END,
    status = _status,
    updated_at = now()
  WHERE access_token = _token::uuid
    AND status IN ('draft', 'sent', 'submitted', 'viewed')
  RETURNING * INTO rfi_row;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  IF _status = 'submitted' AND rfi_row.project_id IS NOT NULL THEN
    SELECT assigned_pm_id, name, property_id INTO proj
    FROM public.projects WHERE id = rfi_row.project_id;

    IF proj.property_id IS NOT NULL THEN
      SELECT address INTO prop_address FROM public.properties WHERE id = proj.property_id;
    END IF;

    IF proj.assigned_pm_id IS NOT NULL THEN
      INSERT INTO public.notifications (company_id, user_id, type, title, body, link, project_id)
      VALUES (
        rfi_row.company_id, proj.assigned_pm_id, 'pis_submitted',
        'PIS submitted: ' || COALESCE(proj.name, rfi_row.title),
        'The client has submitted the Project Information Sheet for ' || COALESCE(prop_address, proj.name) || '.',
        '/projects/' || rfi_row.project_id::text, rfi_row.project_id
      );
    END IF;

    IF (_responses->>'applicant_and_owner_owner_verified') = 'false' 
       AND (_responses->>'applicant_and_owner_owner_name') IS NOT NULL
       AND rfi_row.proposal_id IS NOT NULL THEN
      INSERT INTO public.proposal_contacts (proposal_id, company_id, name, company_name, role, email, phone)
      VALUES (
        rfi_row.proposal_id, rfi_row.company_id,
        _responses->>'applicant_and_owner_owner_name',
        _responses->>'applicant_and_owner_owner_company',
        'owner',
        _responses->>'applicant_and_owner_owner_email',
        _responses->>'applicant_and_owner_owner_phone'
      ) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', rfi_row.id, 'project_id', rfi_row.project_id, 'company_id', rfi_row.company_id);
END;
$$;
