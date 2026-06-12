
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS expected_projects_per_year integer,
  ADD COLUMN IF NOT EXISTS expected_annual_value numeric(12,2);

CREATE OR REPLACE FUNCTION public.convert_lead_to_proposal(_lead_id uuid, _proposal jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_profile_id uuid;
  v_lead public.leads%ROWTYPE;
  v_client_id uuid;
  v_normalized text;
  v_company_name text;
  v_match_id uuid;
  v_proposal_id uuid;
  v_parts text[];
BEGIN
  SELECT id INTO v_caller_profile_id FROM public.profiles WHERE user_id = auth.uid();
  IF v_caller_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = _lead_id;
  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  IF NOT public.is_company_member(v_lead.company_id) THEN
    RAISE EXCEPTION 'Access denied for lead %', _lead_id;
  END IF;

  v_client_id := v_lead.client_id;
  v_company_name := COALESCE(NULLIF(btrim(v_lead.company), ''), v_lead.full_name);

  IF v_client_id IS NULL AND v_company_name IS NOT NULL THEN
    v_normalized := regexp_replace(
      regexp_replace(lower(v_company_name), '[.,''"`]', '', 'g'),
      '\m(inc|llc|ltd|corp|corporation|co|company|group|holdings|associates|partners|llp|pllc)\M', '', 'g'
    );
    v_normalized := btrim(regexp_replace(v_normalized, '\s+', ' ', 'g'));

    SELECT id INTO v_match_id
    FROM public.clients
    WHERE company_id = v_lead.company_id
      AND btrim(regexp_replace(
            regexp_replace(lower(COALESCE(name, '')), '[.,''"`]', '', 'g'),
            '\m(inc|llc|ltd|corp|corporation|co|company|group|holdings|associates|partners|llp|pllc)\M', '', 'g'
          )) = v_normalized
    LIMIT 1;
    v_client_id := v_match_id;
  END IF;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (
      company_id, name, client_type, lead_owner_id,
      expected_annual_value
    )
    VALUES (
      v_lead.company_id, v_company_name, v_lead.client_type, v_lead.assigned_to,
      NULLIF(v_lead.expected_value, 0)
    )
    RETURNING id INTO v_client_id;

    v_parts := regexp_split_to_array(COALESCE(btrim(v_lead.full_name), ''), '\s+');
    INSERT INTO public.client_contacts (
      company_id, client_id, name, first_name, last_name, title, email, phone,
      is_primary, is_referrer, lead_owner_id
    ) VALUES (
      v_lead.company_id, v_client_id,
      COALESCE(v_lead.full_name, v_company_name),
      NULLIF(v_parts[1], ''),
      CASE WHEN array_length(v_parts, 1) > 1
           THEN array_to_string(v_parts[2:array_length(v_parts,1)], ' ')
           ELSE NULL END,
      v_lead.role, v_lead.contact_email, v_lead.contact_phone,
      true, false, v_lead.assigned_to
    );
  END IF;

  INSERT INTO public.proposals (
    company_id, created_by, client_id, lead_id,
    title, client_name, client_email, billed_to_name,
    lead_source, referred_by, project_type, notes,
    assigned_pm_id, sales_person_id,
    architect_name, architect_company, architect_phone, architect_email,
    architect_license_type, architect_license_number,
    gc_name, gc_company, gc_phone, gc_email,
    sia_name, sia_company, sia_phone, sia_email,
    tpp_name, tpp_email
  ) VALUES (
    v_lead.company_id, v_caller_profile_id, v_client_id, v_lead.id,
    COALESCE(_proposal->>'title',
             'Lead: ' || v_lead.full_name ||
             CASE WHEN v_lead.property_address IS NOT NULL
                  THEN ' – ' || v_lead.property_address ELSE '' END),
    COALESCE(_proposal->>'client_name', v_lead.company, v_lead.full_name),
    COALESCE(_proposal->>'client_email', v_lead.contact_email),
    COALESCE(_proposal->>'billed_to_name', v_lead.company),
    COALESCE(_proposal->>'lead_source', v_lead.source),
    COALESCE(_proposal->>'referred_by', v_lead.referred_by),
    COALESCE(_proposal->>'project_type', v_lead.subject),
    COALESCE(_proposal->>'notes', v_lead.notes),
    v_lead.assigned_to, v_lead.assigned_to,
    v_lead.architect_name, v_lead.architect_company, v_lead.architect_phone, v_lead.architect_email,
    v_lead.architect_license_type, v_lead.architect_license_number,
    v_lead.gc_name, v_lead.gc_company, v_lead.gc_phone, v_lead.gc_email,
    v_lead.sia_name, v_lead.sia_company, v_lead.sia_phone, v_lead.sia_email,
    v_lead.tpp_name, v_lead.tpp_email
  )
  RETURNING id INTO v_proposal_id;

  UPDATE public.leads
  SET client_id   = v_client_id,
      proposal_id = v_proposal_id,
      stage       = 'PROPOSAL'::bd_lead_stage,
      status      = 'converted',
      updated_by  = v_caller_profile_id,
      updated_at  = now()
  WHERE id = v_lead.id;

  -- Best-effort notification: never roll back conversion if this fails
  BEGIN
    IF v_lead.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications (company_id, user_id, type, title, body, link)
      VALUES (
        v_lead.company_id, v_lead.assigned_to, 'lead_converted',
        'Lead converted: ' || COALESCE(v_lead.full_name, 'Lead'),
        'Your lead was converted to a proposal.',
        '/proposals/' || v_proposal_id::text
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'lead_converted notification failed: %', SQLERRM;
  END;

  RETURN v_proposal_id;
END;
$function$;
