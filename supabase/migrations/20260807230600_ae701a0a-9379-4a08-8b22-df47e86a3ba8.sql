-- ============================================================
-- get_public_proposal — project an explicit safe-column allowlist
--
-- Previously this SECURITY DEFINER RPC returned `to_jsonb(prop)` — the ENTIRE
-- proposals row — to any anonymous token holder on the public proposal page.
-- That leaked internal-only fields such as `notes`, `metadata`, follow-up
-- cadence, lead source / referral, sales_person_id, assigned_pm_id,
-- created_by, client_id, converted_* ids, the audit trail (client_ip_address,
-- signed_user_agent, signed_document_hash/url) and the token itself.
--
-- This rebuilds the payload from an explicit client-facing column allowlist
-- (mirroring the PUBLIC_CO_COLUMNS pattern in supabase/functions/public-co),
-- so internal fields can never leak regardless of future schema changes.
-- Only the projected object changes; the bundled items/milestones/contacts/
-- company/property/signer/rfi data and the expiry gate are unchanged.
-- ============================================================
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

  -- Expired? Only block when not yet signed; signed proposals stay viewable for the record.
  IF prop.client_signed_at IS NULL
     AND prop.public_token_expires_at IS NOT NULL
     AND prop.public_token_expires_at < now() THEN
    RETURN jsonb_build_object('expired', true, 'proposal_number', prop.proposal_number);
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(pi)), '[]'::jsonb) INTO items_json
  FROM public.proposal_items pi WHERE pi.proposal_id = prop.id;

  SELECT COALESCE(jsonb_agg(to_jsonb(pm)), '[]'::jsonb) INTO milestones_json
  FROM public.proposal_milestones pm WHERE pm.proposal_id = prop.id;

  SELECT COALESCE(jsonb_agg(to_jsonb(pc)), '[]'::jsonb) INTO contacts_json
  FROM public.proposal_contacts pc WHERE pc.proposal_id = prop.id;

  SELECT jsonb_build_object(
    'name', c.name, 'address', c.address, 'phone', c.phone,
    'email', c.email, 'website', c.website, 'logo_url', c.logo_url,
    'settings', c.settings
  ) INTO company_json
  FROM public.companies c WHERE c.id = prop.company_id;

  SELECT jsonb_build_object(
    'id', pr.id, 'address', pr.address, 'borough', pr.borough
  ) INTO property_json
  FROM public.properties pr WHERE pr.id = prop.property_id;

  IF prop.internal_signed_by IS NOT NULL THEN
    SELECT jsonb_build_object(
      'first_name', p.first_name, 'last_name', p.last_name
    ) INTO internal_signer_json
    FROM public.profiles p WHERE p.id = prop.internal_signed_by;
  END IF;

  SELECT r.access_token::text INTO rfi_token
  FROM public.rfi_requests r WHERE r.proposal_id = prop.id LIMIT 1;

  -- Explicit client-facing allowlist — never `to_jsonb(prop)`. Any column not
  -- named here is withheld from anon token holders.
  result := jsonb_build_object(
    'id', prop.id,
    'proposal_number', prop.proposal_number,
    'title', prop.title,
    'status', prop.status,
    'created_at', prop.created_at,
    'valid_until', prop.valid_until,
    'viewed_at', prop.viewed_at,
    'subtotal', prop.subtotal,
    'total_amount', prop.total_amount,
    'tax_rate', prop.tax_rate,
    'tax_amount', prop.tax_amount,
    'deposit_percentage', prop.deposit_percentage,
    'deposit_required', prop.deposit_required,
    'payment_terms', prop.payment_terms,
    'terms_conditions', prop.terms_conditions,
    'scope_of_work', prop.scope_of_work,
    'client_name', prop.client_name,
    'client_email', prop.client_email,
    'billed_to_name', prop.billed_to_name,
    'billed_to_email', prop.billed_to_email,
    'client_signed_at', prop.client_signed_at,
    'client_signed_name', prop.client_signed_name,
    'client_signed_title', prop.client_signed_title,
    'client_signer_name', prop.client_signer_name,
    'client_signer_title', prop.client_signer_title,
    'client_signature_data', prop.client_signature_data,
    'internal_signed_at', prop.internal_signed_at,
    'internal_signature_data', prop.internal_signature_data,
    'architect_company', prop.architect_company,
    'architect_name', prop.architect_name,
    'architect_email', prop.architect_email,
    'architect_phone', prop.architect_phone,
    'architect_license_number', prop.architect_license_number,
    'architect_license_type', prop.architect_license_type,
    'gc_company', prop.gc_company,
    'gc_name', prop.gc_name,
    'gc_email', prop.gc_email,
    'gc_phone', prop.gc_phone
  );

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

GRANT EXECUTE ON FUNCTION public.get_public_proposal(text) TO anon, authenticated;
