
CREATE OR REPLACE FUNCTION public.get_lead_connections(_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_company_norm text;
  v_addr_norm text;
  v_people jsonb := '[]'::jsonb;
  v_projects jsonb := '[]'::jsonb;
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

  -- Company normalization (same recipe as preview_lead_client_match)
  IF COALESCE(btrim(v_lead.company), '') <> '' THEN
    v_company_norm := btrim(regexp_replace(
      regexp_replace(
        regexp_replace(lower(v_lead.company), '[.,''"`]', '', 'g'),
        '\m(inc|llc|ltd|corp|corporation|co|company|group|holdings|associates|partners|llp|pllc)\M', '', 'g'
      ),
      '\s+', ' ', 'g'
    ));
    IF v_company_norm = '' THEN v_company_norm := NULL; END IF;
  END IF;

  -- Address normalization: strip suite/floor/apt/unit, lowercase, collapse whitespace
  IF COALESCE(btrim(v_lead.property_address), '') <> '' THEN
    v_addr_norm := btrim(regexp_replace(
      regexp_replace(
        regexp_replace(lower(v_lead.property_address),
          '\m(suite|ste|floor|fl|apt|apartment|unit|#)\.?\s*[a-z0-9\-]+', '', 'g'),
        '[.,#]', '', 'g'
      ),
      '\s+', ' ', 'g'
    ));
    IF v_addr_norm = '' THEN v_addr_norm := NULL; END IF;
  END IF;

  -- PEOPLE: other leads + client_contacts at same normalized company
  IF v_company_norm IS NOT NULL THEN
    WITH other_leads AS (
      SELECT
        l.id,
        l.full_name AS name,
        COALESCE(l.role, 'Lead') AS role,
        'lead'::text AS kind,
        l.stage::text AS context,
        c.name AS client_name
      FROM public.leads l
      LEFT JOIN public.clients c ON c.id = l.client_id
      WHERE l.company_id = v_lead.company_id
        AND l.id <> v_lead.id
        AND l.deleted_at IS NULL
        AND COALESCE(btrim(l.company), '') <> ''
        AND btrim(regexp_replace(
              regexp_replace(
                regexp_replace(lower(l.company), '[.,''"`]', '', 'g'),
                '\m(inc|llc|ltd|corp|corporation|co|company|group|holdings|associates|partners|llp|pllc)\M', '', 'g'
              ),
              '\s+', ' ', 'g'
            )) = v_company_norm
      LIMIT 25
    ),
    contacts AS (
      SELECT
        cc.id,
        cc.name,
        COALESCE(cc.title, 'Contact') AS role,
        'contact'::text AS kind,
        NULL::text AS context,
        c.name AS client_name
      FROM public.client_contacts cc
      JOIN public.clients c ON c.id = cc.client_id
      WHERE cc.company_id = v_lead.company_id
        AND (
          btrim(regexp_replace(
            regexp_replace(
              regexp_replace(lower(COALESCE(c.name, '')), '[.,''"`]', '', 'g'),
              '\m(inc|llc|ltd|corp|corporation|co|company|group|holdings|associates|partners|llp|pllc)\M', '', 'g'
            ),
            '\s+', ' ', 'g'
          )) = v_company_norm
          OR btrim(regexp_replace(
            regexp_replace(
              regexp_replace(lower(COALESCE(cc.company_name, '')), '[.,''"`]', '', 'g'),
              '\m(inc|llc|ltd|corp|corporation|co|company|group|holdings|associates|partners|llp|pllc)\M', '', 'g'
            ),
            '\s+', ' ', 'g'
          )) = v_company_norm
        )
      LIMIT 25
    )
    SELECT jsonb_agg(row_to_json(p)) INTO v_people
    FROM (
      SELECT * FROM other_leads
      UNION ALL
      SELECT * FROM contacts
    ) p;
  END IF;

  -- PROJECTS at this address
  IF v_addr_norm IS NOT NULL THEN
    SELECT jsonb_agg(row_to_json(x)) INTO v_projects
    FROM (
      SELECT
        pr.id,
        pr.project_number,
        pr.status,
        EXTRACT(YEAR FROM pr.created_at)::int AS year,
        p.address AS property_address,
        p.id AS property_id
      FROM public.properties p
      JOIN public.projects pr ON pr.property_id = p.id
      WHERE p.company_id = v_lead.company_id
        AND btrim(regexp_replace(
              regexp_replace(
                regexp_replace(lower(p.address),
                  '\m(suite|ste|floor|fl|apt|apartment|unit|#)\.?\s*[a-z0-9\-]+', '', 'g'),
                '[.,#]', '', 'g'
              ),
              '\s+', ' ', 'g'
            )) = v_addr_norm
      ORDER BY pr.created_at DESC
      LIMIT 25
    ) x;
  END IF;

  RETURN jsonb_build_object(
    'people', COALESCE(v_people, '[]'::jsonb),
    'projects', COALESCE(v_projects, '[]'::jsonb),
    'company_norm', v_company_norm,
    'address_norm', v_addr_norm
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lead_connections(uuid) TO authenticated;
