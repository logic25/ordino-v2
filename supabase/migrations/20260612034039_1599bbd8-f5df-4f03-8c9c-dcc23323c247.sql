CREATE OR REPLACE FUNCTION public.preview_lead_client_match(_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_company_name text;
  v_normalized text;
  v_match record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = _lead_id;
  IF v_lead.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Lead not found');
  END IF;
  IF NOT public.is_company_member(v_lead.company_id) THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  -- Already linked: short-circuit
  IF v_lead.client_id IS NOT NULL THEN
    SELECT id, name INTO v_match FROM public.clients WHERE id = v_lead.client_id;
    RETURN jsonb_build_object(
      'action', 'link_existing',
      'client_id', v_match.id,
      'client_name', v_match.name,
      'reason', 'already_linked'
    );
  END IF;

  v_company_name := COALESCE(NULLIF(btrim(v_lead.company), ''), v_lead.full_name);
  IF v_company_name IS NULL OR v_company_name = '' THEN
    RETURN jsonb_build_object('action', 'create_new', 'client_name', NULL);
  END IF;

  v_normalized := regexp_replace(
    regexp_replace(lower(v_company_name), '[.,''"`]', '', 'g'),
    '\m(inc|llc|ltd|corp|corporation|co|company|group|holdings|associates|partners|llp|pllc)\M', '', 'g'
  );
  v_normalized := btrim(regexp_replace(v_normalized, '\s+', ' ', 'g'));

  SELECT id, name INTO v_match
  FROM public.clients
  WHERE company_id = v_lead.company_id
    AND btrim(regexp_replace(
          regexp_replace(lower(COALESCE(name, '')), '[.,''"`]', '', 'g'),
          '\m(inc|llc|ltd|corp|corporation|co|company|group|holdings|associates|partners|llp|pllc)\M', '', 'g'
        )) = v_normalized
  LIMIT 1;

  IF v_match.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'action', 'link_existing',
      'client_id', v_match.id,
      'client_name', v_match.name,
      'reason', 'fuzzy_match'
    );
  END IF;

  RETURN jsonb_build_object(
    'action', 'create_new',
    'client_name', v_company_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_lead_client_match(uuid) TO authenticated;