-- Recreate sign_proposal to force schema refresh
CREATE OR REPLACE FUNCTION public.sign_proposal(_token text, _signer_name text, _signer_title text, _signature_data text, _signer_ip text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prop_row record;
BEGIN
  UPDATE public.proposals SET
    client_signed_at = now(),
    client_signer_name = _signer_name,
    client_signer_title = _signer_title,
    client_signature_data = _signature_data,
    client_ip_address = _signer_ip,
    status = 'executed'
  WHERE public_token = _token
    AND client_signed_at IS NULL
  RETURNING id, company_id, assigned_pm_id, title, proposal_number, converted_project_id, property_id INTO prop_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found or already signed');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', prop_row.id,
    'company_id', prop_row.company_id,
    'assigned_pm_id', prop_row.assigned_pm_id,
    'title', prop_row.title,
    'proposal_number', prop_row.proposal_number,
    'converted_project_id', prop_row.converted_project_id
  );
END;
$function$;

-- Also notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';