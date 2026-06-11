
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public.sign_proposal(
  _token text,
  _signer_name text,
  _signer_title text,
  _signature_data text,
  _signer_ip text DEFAULT NULL,
  _signer_user_agent text DEFAULT NULL,
  _document_hash text DEFAULT NULL  -- ignored; kept for client compatibility
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  prop_row record;
  property_address text;
  canonical text;
  computed_hash text;
  computed_total numeric;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.proposals
    WHERE public_token = _token
      AND client_signed_at IS NULL
      AND public_token_expires_at IS NOT NULL
      AND public_token_expires_at < now()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link expired');
  END IF;

  -- Build canonical string + hash from current proposal_items
  SELECT
    COALESCE(string_agg(
      COALESCE(pi.name,'') || '|' ||
      COALESCE(pi.quantity::text,'0') || '|' ||
      COALESCE(pi.unit_price::text,'0'),
      E'\n' ORDER BY pi.sort_order, pi.id
    ), ''),
    COALESCE(SUM(COALESCE(pi.total_price, pi.quantity * pi.unit_price, 0)), 0)
  INTO canonical, computed_total
  FROM public.proposals p
  LEFT JOIN public.proposal_items pi ON pi.proposal_id = p.id
  WHERE p.public_token = _token
  GROUP BY p.id;

  canonical := COALESCE(canonical,'') || E'\nTOTAL:' || COALESCE(computed_total::text,'0');
  computed_hash := encode(public.digest(canonical, 'sha256'), 'hex');

  UPDATE public.proposals SET
    client_signed_at = now(),
    client_signer_name = _signer_name,
    client_signer_title = _signer_title,
    client_signature_data = _signature_data,
    client_ip_address = _signer_ip,
    signed_user_agent = _signer_user_agent,
    signed_document_hash = computed_hash,
    public_token_expires_at = now(),
    status = 'executed'
  WHERE public_token = _token
    AND client_signed_at IS NULL
  RETURNING id, company_id, assigned_pm_id, title, proposal_number, converted_project_id, property_id INTO prop_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found or already signed');
  END IF;

  IF prop_row.assigned_pm_id IS NOT NULL THEN
    SELECT address INTO property_address FROM public.properties WHERE id = prop_row.property_id;
    INSERT INTO public.notifications (company_id, user_id, type, title, body, link, project_id)
    VALUES (
      prop_row.company_id,
      prop_row.assigned_pm_id,
      'proposal_signed',
      'Client signed: ' || COALESCE(prop_row.title, prop_row.proposal_number),
      COALESCE(_signer_name, 'The client') || ' counter-signed the proposal'
        || COALESCE(' for ' || property_address, '') || '.',
      CASE WHEN prop_row.converted_project_id IS NOT NULL
           THEN '/projects/' || prop_row.converted_project_id::text
           ELSE '/proposals' END,
      prop_row.converted_project_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', prop_row.id,
    'company_id', prop_row.company_id,
    'assigned_pm_id', prop_row.assigned_pm_id,
    'title', prop_row.title,
    'proposal_number', prop_row.proposal_number,
    'converted_project_id', prop_row.converted_project_id,
    'document_hash', computed_hash
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.sign_change_order(
  _token text,
  _signer_name text,
  _signature_data text,
  _signer_ip text DEFAULT NULL,
  _signer_user_agent text DEFAULT NULL,
  _document_hash text DEFAULT NULL  -- ignored; kept for client compatibility
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  co_row record;
  pm_id uuid;
  canonical text;
  computed_hash text;
  item jsonb;
BEGIN
  SELECT id, status, client_signed_at, company_id, project_id, co_number, title, amount, line_items, description
    INTO co_row
  FROM public.change_orders WHERE public_token = _token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;
  IF co_row.client_signed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already signed');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.change_orders
    WHERE id = co_row.id
      AND public_token_expires_at IS NOT NULL
      AND public_token_expires_at < now()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link expired');
  END IF;

  -- Canonical string from line_items (or fallback to title/amount)
  canonical := '';
  IF co_row.line_items IS NOT NULL AND jsonb_typeof(co_row.line_items) = 'array'
     AND jsonb_array_length(co_row.line_items) > 0 THEN
    FOR item IN SELECT * FROM jsonb_array_elements(co_row.line_items) LOOP
      canonical := canonical
        || COALESCE(item->>'name','') || '|1|'
        || COALESCE(item->>'amount','0') || E'\n';
    END LOOP;
  ELSE
    canonical := COALESCE(co_row.title,'') || '|1|' || COALESCE(co_row.amount::text,'0') || E'\n';
  END IF;
  canonical := canonical || 'TOTAL:' || COALESCE(co_row.amount::text,'0');
  computed_hash := encode(public.digest(canonical, 'sha256'), 'hex');

  UPDATE public.change_orders SET
    client_signature_data = _signature_data,
    client_signer_name = _signer_name,
    client_signed_at = now(),
    signed_ip = _signer_ip,
    signed_user_agent = _signer_user_agent,
    signed_document_hash = computed_hash,
    public_token_expires_at = now(),
    status = 'approved',
    approved_at = now()
  WHERE id = co_row.id;

  IF co_row.amount > 0 THEN
    INSERT INTO public.billing_requests (
      company_id, project_id, services, total_amount, status
    ) VALUES (
      co_row.company_id, co_row.project_id,
      jsonb_build_array(jsonb_build_object('name', co_row.title, 'quantity', 1, 'rate', co_row.amount, 'amount', co_row.amount)),
      co_row.amount, 'pending'
    );
  END IF;

  SELECT assigned_pm_id INTO pm_id FROM public.projects WHERE id = co_row.project_id;
  IF pm_id IS NOT NULL THEN
    INSERT INTO public.notifications (company_id, user_id, type, title, body, link, project_id)
    VALUES (
      co_row.company_id, pm_id, 'co_client_signed',
      'Change Order signed: ' || co_row.co_number,
      COALESCE(_signer_name, 'The client') || ' signed ' || co_row.co_number || ' (' || co_row.title || ').',
      '/projects/' || co_row.project_id::text,
      co_row.project_id
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'id', co_row.id, 'document_hash', computed_hash);
END;
$function$;
