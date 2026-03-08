
-- ============================================================
-- Security Fix: Token-verified public access via RPCs
-- ============================================================

-- 1. PROPOSALS: Remove dangerous anon policies
DROP POLICY IF EXISTS "Public can view proposals by token" ON public.proposals;
DROP POLICY IF EXISTS "Public can sign proposals by token" ON public.proposals;

-- 2. PROPOSAL_MILESTONES: Remove open policy
DROP POLICY IF EXISTS "Public can view proposal milestones" ON public.proposal_milestones;

-- 3. PROPOSAL_CONTACTS: Remove token IS NOT NULL policy
DROP POLICY IF EXISTS "Public can view proposal contacts via token" ON public.proposal_contacts;

-- Keep authenticated company-member access (check if already exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='proposal_contacts' AND policyname='Company members can view proposal contacts') THEN
    CREATE POLICY "Company members can view proposal contacts" ON public.proposal_contacts
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM proposals p WHERE p.id = proposal_contacts.proposal_id AND is_company_member(p.company_id)));
  END IF;
END $$;

-- 4. PROPOSAL_ITEMS: Remove token IS NOT NULL policy
DROP POLICY IF EXISTS "Public can view proposal items via token" ON public.proposal_items;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='proposal_items' AND policyname='Company members can view proposal items') THEN
    CREATE POLICY "Company members can view proposal items" ON public.proposal_items
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM proposals p WHERE p.id = proposal_items.proposal_id AND is_company_member(p.company_id)));
  END IF;
END $$;

-- 5. RFI_REQUESTS: Remove dangerous anon policies
DROP POLICY IF EXISTS "Public can view rfi by access token" ON public.rfi_requests;
DROP POLICY IF EXISTS "Public can submit rfi responses by access token" ON public.rfi_requests;

-- 6. PROFILES: Remove anon policy that exposes salary data
DROP POLICY IF EXISTS "Public can view basic profile info" ON public.profiles;

-- 7. COMPANIES: Remove overly permissive anon policies
DROP POLICY IF EXISTS "Public can view company info via token" ON public.companies;
DROP POLICY IF EXISTS "Authenticated can view company via CO token" ON public.companies;

-- 8. Other anon policies with IS NOT NULL token checks
DROP POLICY IF EXISTS "Public can view properties linked to public proposals" ON public.properties;
DROP POLICY IF EXISTS "anon_read_property_via_co" ON public.properties;
DROP POLICY IF EXISTS "anon_read_project_via_co" ON public.projects;
DROP POLICY IF EXISTS "anon_read_client_via_co" ON public.clients;
DROP POLICY IF EXISTS "Anon can fulfill pis_tracking via public token" ON public.pis_tracking;

-- ============================================================
-- Create secure RPCs for public access
-- ============================================================

-- Get full proposal bundle by token (proposal + items + milestones + company + contacts + property + profiles)
CREATE OR REPLACE FUNCTION public.get_public_proposal(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prop record;
  result jsonb;
  items_json jsonb;
  milestones_json jsonb;
  contacts_json jsonb;
  company_json jsonb;
  property_json jsonb;
  internal_signer_json jsonb;
  rfi_token text;
BEGIN
  SELECT * INTO prop FROM public.proposals WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Items
  SELECT COALESCE(jsonb_agg(to_jsonb(pi)), '[]'::jsonb) INTO items_json
  FROM public.proposal_items pi WHERE pi.proposal_id = prop.id;

  -- Milestones
  SELECT COALESCE(jsonb_agg(to_jsonb(pm)), '[]'::jsonb) INTO milestones_json
  FROM public.proposal_milestones pm WHERE pm.proposal_id = prop.id;

  -- Contacts
  SELECT COALESCE(jsonb_agg(to_jsonb(pc)), '[]'::jsonb) INTO contacts_json
  FROM public.proposal_contacts pc WHERE pc.proposal_id = prop.id;

  -- Company (safe fields only)
  SELECT jsonb_build_object(
    'name', c.name, 'address', c.address, 'phone', c.phone,
    'email', c.email, 'website', c.website, 'logo_url', c.logo_url,
    'settings', c.settings
  ) INTO company_json
  FROM public.companies c WHERE c.id = prop.company_id;

  -- Property
  SELECT jsonb_build_object(
    'id', pr.id, 'address', pr.address, 'borough', pr.borough
  ) INTO property_json
  FROM public.properties pr WHERE pr.id = prop.property_id;

  -- Internal signer (safe fields only)
  IF prop.internal_signed_by IS NOT NULL THEN
    SELECT jsonb_build_object(
      'first_name', p.first_name, 'last_name', p.last_name
    ) INTO internal_signer_json
    FROM public.profiles p WHERE p.id = prop.internal_signed_by;
  END IF;

  -- RFI token
  SELECT r.access_token::text INTO rfi_token
  FROM public.rfi_requests r WHERE r.proposal_id = prop.id LIMIT 1;

  result := to_jsonb(prop);
  result := result || jsonb_build_object(
    'items', items_json,
    'milestones', milestones_json,
    'contacts', contacts_json,
    'company', company_json,
    'properties', property_json,
    'internal_signer', internal_signer_json,
    'rfi_token', rfi_token
  );

  RETURN result;
END;
$$;

-- Sign proposal by token
CREATE OR REPLACE FUNCTION public.sign_proposal(
  _token text,
  _signer_name text,
  _signer_title text,
  _signature_data text,
  _signer_ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Track proposal view
CREATE OR REPLACE FUNCTION public.track_proposal_view(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.proposals SET
    viewed_at = COALESCE(viewed_at, now())
  WHERE public_token = _token;
END;
$$;

-- Get public RFI data by token
CREATE OR REPLACE FUNCTION public.get_public_rfi(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rfi_row record;
  result jsonb;
  prop_json jsonb;
  proj_json jsonb;
  property_json jsonb;
  plan_names text[];
BEGIN
  SELECT * INTO rfi_row FROM public.rfi_requests
  WHERE access_token = _token::uuid
    AND status IN ('draft', 'sent', 'submitted');
  IF NOT FOUND THEN RETURN NULL; END IF;

  result := to_jsonb(rfi_row);

  -- Property (direct or via project/proposal)
  IF rfi_row.property_id IS NOT NULL THEN
    SELECT jsonb_build_object('address', pr.address, 'borough', pr.borough, 'block', pr.block, 'lot', pr.lot, 'owner_name', pr.owner_name)
    INTO property_json FROM public.properties pr WHERE pr.id = rfi_row.property_id;
  END IF;

  -- Project data
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

    -- Get property from project if not direct
    IF property_json IS NULL THEN
      SELECT jsonb_build_object('address', pr.address, 'borough', pr.borough, 'block', pr.block, 'lot', pr.lot, 'owner_name', pr.owner_name)
      INTO property_json FROM public.properties pr
      WHERE pr.id = (SELECT property_id FROM public.projects WHERE id = rfi_row.project_id);
    END IF;
  END IF;

  -- Proposal data
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

    -- Get property from proposal if not yet found
    IF property_json IS NULL AND prop_json->>'property_id' IS NOT NULL THEN
      SELECT jsonb_build_object('address', pr.address, 'borough', pr.borough, 'block', pr.block, 'lot', pr.lot, 'owner_name', pr.owner_name)
      INTO property_json FROM public.properties pr
      WHERE pr.id = (prop_json->>'property_id')::uuid;
    END IF;
  END IF;

  -- Plan filenames
  plan_names := get_rfi_plan_filenames(_token);

  result := result || jsonb_build_object(
    'resolved_property', property_json,
    'project_data', proj_json,
    'proposal_data', prop_json,
    'plan_filenames', to_jsonb(plan_names)
  );

  RETURN result;
END;
$$;

-- Submit RFI response by token
CREATE OR REPLACE FUNCTION public.submit_rfi_response(
  _token text,
  _responses jsonb,
  _status text DEFAULT 'submitted'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rfi_requests SET
    responses = _responses,
    submitted_at = CASE WHEN _status = 'submitted' THEN COALESCE(submitted_at, now()) ELSE submitted_at END,
    status = _status,
    updated_at = now()
  WHERE access_token = _token::uuid
    AND status IN ('draft', 'sent', 'submitted');
  
  RETURN FOUND;
END;
$$;

-- Mark RFI as viewed
CREATE OR REPLACE FUNCTION public.track_rfi_view(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rfi_requests SET
    viewed_at = COALESCE(viewed_at, now()),
    status = CASE WHEN status = 'sent' THEN 'sent' ELSE status END
  WHERE access_token = _token::uuid;
END;
$$;

-- Get public company info (safe fields only)
CREATE OR REPLACE FUNCTION public.get_public_company_info(_company_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', id, 'name', name, 'logo_url', logo_url,
    'address', address, 'phone', phone, 'email', email,
    'website', website, 'settings', settings
  )
  FROM public.companies WHERE id = _company_id
$$;

-- Get safe profile info
CREATE OR REPLACE FUNCTION public.get_public_profile_info(_profile_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', id, 'first_name', first_name, 'last_name', last_name,
    'display_name', display_name, 'avatar_url', avatar_url
  )
  FROM public.profiles WHERE id = _profile_id
$$;
