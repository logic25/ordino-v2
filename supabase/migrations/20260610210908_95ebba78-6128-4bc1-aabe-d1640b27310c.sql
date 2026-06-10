
-- ============================================================
-- 1. NOTIFICATION SPOOFING FIX
-- Drop the anon INSERT policy. All notification writes now go
-- through SECURITY DEFINER RPCs.
-- ============================================================
DROP POLICY IF EXISTS "Public pages can create notifications" ON public.notifications;

-- ============================================================
-- 3. SIGNATURE AUDIT TRAIL — add columns
-- ============================================================
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS signed_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS signed_document_hash TEXT;

ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS signed_ip TEXT,
  ADD COLUMN IF NOT EXISTS signed_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS signed_document_hash TEXT;

-- ============================================================
-- 4. TOKEN EXPIRY — add columns + backfill
-- ============================================================
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMPTZ;

ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMPTZ;

-- Backfill: existing tokens expire 90 days after creation
UPDATE public.proposals
  SET public_token_expires_at = created_at + INTERVAL '90 days'
  WHERE public_token IS NOT NULL AND public_token_expires_at IS NULL;

UPDATE public.change_orders
  SET public_token_expires_at = created_at + INTERVAL '90 days'
  WHERE public_token IS NOT NULL AND public_token_expires_at IS NULL;

-- Update token-generation triggers to also set expiry
CREATE OR REPLACE FUNCTION public.generate_proposal_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := replace(gen_random_uuid()::text, '-', '');
  END IF;
  IF NEW.public_token IS NOT NULL AND NEW.public_token_expires_at IS NULL THEN
    NEW.public_token_expires_at := now() + INTERVAL '90 days';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_co_public_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := replace(gen_random_uuid()::text, '-', '');
  END IF;
  IF NEW.public_token IS NOT NULL AND NEW.public_token_expires_at IS NULL THEN
    NEW.public_token_expires_at := now() + INTERVAL '90 days';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- get_public_proposal — gate by expiry, return error object when expired
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

-- ============================================================
-- sign_proposal — adds audit columns + freezes expiry + sends notification inline
-- ============================================================
CREATE OR REPLACE FUNCTION public.sign_proposal(
  _token text,
  _signer_name text,
  _signer_title text,
  _signature_data text,
  _signer_ip text DEFAULT NULL,
  _signer_user_agent text DEFAULT NULL,
  _document_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prop_row record;
  property_address text;
BEGIN
  -- Reject expired tokens
  IF EXISTS (
    SELECT 1 FROM public.proposals
    WHERE public_token = _token
      AND client_signed_at IS NULL
      AND public_token_expires_at IS NOT NULL
      AND public_token_expires_at < now()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link expired');
  END IF;

  UPDATE public.proposals SET
    client_signed_at = now(),
    client_signer_name = _signer_name,
    client_signer_title = _signer_title,
    client_signature_data = _signature_data,
    client_ip_address = _signer_ip,
    signed_user_agent = _signer_user_agent,
    signed_document_hash = _document_hash,
    public_token_expires_at = now(),  -- freeze
    status = 'executed'
  WHERE public_token = _token
    AND client_signed_at IS NULL
  RETURNING id, company_id, assigned_pm_id, title, proposal_number, converted_project_id, property_id INTO prop_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found or already signed');
  END IF;

  -- Notify assigned PM (server-side, no spoofing surface)
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
    'converted_project_id', prop_row.converted_project_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sign_proposal(text, text, text, text, text, text, text) TO anon, authenticated;

-- ============================================================
-- sign_change_order RPC — replaces inline writes in public-co
-- ============================================================
CREATE OR REPLACE FUNCTION public.sign_change_order(
  _token text,
  _signer_name text,
  _signature_data text,
  _signer_ip text DEFAULT NULL,
  _signer_user_agent text DEFAULT NULL,
  _document_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  co_row record;
  pm_id uuid;
BEGIN
  SELECT id, status, client_signed_at, company_id, project_id, co_number, title, amount
    INTO co_row
  FROM public.change_orders WHERE public_token = _token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;
  IF co_row.client_signed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already signed');
  END IF;

  -- Expiry guard
  IF EXISTS (
    SELECT 1 FROM public.change_orders
    WHERE id = co_row.id
      AND public_token_expires_at IS NOT NULL
      AND public_token_expires_at < now()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link expired');
  END IF;

  UPDATE public.change_orders SET
    client_signature_data = _signature_data,
    client_signer_name = _signer_name,
    client_signed_at = now(),
    signed_ip = _signer_ip,
    signed_user_agent = _signer_user_agent,
    signed_document_hash = _document_hash,
    public_token_expires_at = now(),
    status = 'approved',
    approved_at = now()
  WHERE id = co_row.id;

  -- Create billing request for approved CO (skip credits / zero)
  IF co_row.amount > 0 THEN
    INSERT INTO public.billing_requests (
      company_id, project_id, services, total_amount, status
    ) VALUES (
      co_row.company_id, co_row.project_id,
      jsonb_build_array(jsonb_build_object('name', co_row.title, 'quantity', 1, 'rate', co_row.amount, 'amount', co_row.amount)),
      co_row.amount, 'pending'
    );
  END IF;

  -- Notify project PM if known
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

  RETURN jsonb_build_object('success', true, 'id', co_row.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sign_change_order(text, text, text, text, text, text) TO anon, authenticated;

-- ============================================================
-- pay_co_deposit RPC — replaces inline retainer/invoice writes in public-co
-- ============================================================
CREATE OR REPLACE FUNCTION public.pay_co_deposit(
  _token text,
  _payment_method text DEFAULT 'check'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  co_row record;
  deposit_amt numeric;
  client_id_v uuid;
  retainer_id_v uuid;
  pm_id uuid;
BEGIN
  SELECT id, status, deposit_paid_at, deposit_percentage, amount,
         company_id, project_id, co_number, title
    INTO co_row
  FROM public.change_orders WHERE public_token = _token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;
  IF co_row.deposit_paid_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit already paid');
  END IF;

  deposit_amt := ROUND(co_row.amount * COALESCE(co_row.deposit_percentage, 0) / 100, 2);

  UPDATE public.change_orders
    SET deposit_paid_at = now()
    WHERE id = co_row.id;

  SELECT client_id INTO client_id_v FROM public.projects WHERE id = co_row.project_id;

  IF deposit_amt > 0 AND client_id_v IS NOT NULL THEN
    INSERT INTO public.client_retainers (
      company_id, client_id, project_id, initial_amount, current_balance, source
    ) VALUES (
      co_row.company_id, client_id_v, co_row.project_id,
      deposit_amt, deposit_amt,
      'CO ' || co_row.co_number || ' deposit'
    ) RETURNING id INTO retainer_id_v;

    INSERT INTO public.retainer_transactions (
      company_id, retainer_id, type, amount, description
    ) VALUES (
      co_row.company_id, retainer_id_v, 'deposit', deposit_amt,
      'Deposit for Change Order ' || co_row.co_number
    );
  END IF;

  IF deposit_amt > 0 THEN
    INSERT INTO public.invoices (
      company_id, project_id, client_id,
      line_items, subtotal, total_due, status,
      payment_amount, payment_method, payment_date, paid_at
    ) VALUES (
      co_row.company_id, co_row.project_id, client_id_v,
      jsonb_build_array(jsonb_build_object(
        'description', 'Deposit — ' || co_row.co_number || ': ' || co_row.title,
        'quantity', 1, 'rate', deposit_amt, 'amount', deposit_amt
      )),
      deposit_amt, deposit_amt, 'paid',
      deposit_amt, _payment_method, CURRENT_DATE, now()
    );
  END IF;

  -- Notify PM
  SELECT assigned_pm_id INTO pm_id FROM public.projects WHERE id = co_row.project_id;
  IF pm_id IS NOT NULL THEN
    INSERT INTO public.notifications (company_id, user_id, type, title, body, link, project_id)
    VALUES (
      co_row.company_id, pm_id, 'deposit_paid',
      'Deposit received: ' || co_row.co_number,
      'Client paid ' || to_char(deposit_amt, 'FM$999,999,990.00') || ' deposit for ' || co_row.co_number || '.',
      '/projects/' || co_row.project_id::text,
      co_row.project_id
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'deposit_amount', deposit_amt);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_co_deposit(text, text) TO anon, authenticated;

-- ============================================================
-- extend_public_token RPC — admin-callable to refresh expiry on
-- a proposal or change order link (for the "Resend Link" button)
-- ============================================================
CREATE OR REPLACE FUNCTION public.extend_public_token(
  _entity text,   -- 'proposal' or 'change_order'
  _id uuid,
  _days int DEFAULT 90
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean;
  comp uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF _entity NOT IN ('proposal', 'change_order') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid entity');
  END IF;
  IF _days <= 0 OR _days > 365 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid days (1-365)');
  END IF;

  IF _entity = 'proposal' THEN
    SELECT company_id INTO comp FROM public.proposals WHERE id = _id;
  ELSE
    SELECT company_id INTO comp FROM public.change_orders WHERE id = _id;
  END IF;
  IF comp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;
  IF NOT public.is_company_member(comp) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  IF _entity = 'proposal' THEN
    UPDATE public.proposals
      SET public_token_expires_at = now() + (_days || ' days')::interval
      WHERE id = _id;
  ELSE
    UPDATE public.change_orders
      SET public_token_expires_at = now() + (_days || ' days')::interval
      WHERE id = _id;
  END IF;

  RETURN jsonb_build_object('success', true, 'new_expiry', (now() + (_days || ' days')::interval));
END;
$$;

GRANT EXECUTE ON FUNCTION public.extend_public_token(text, uuid, int) TO authenticated;

-- ============================================================
-- 7. RFI UPLOAD — tighten extension whitelist
-- ============================================================
DROP POLICY IF EXISTS "Upload RFI attachments to valid RFI folder" ON storage.objects;

CREATE POLICY "Upload RFI attachments to valid RFI folder"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'rfi-attachments'
  AND EXISTS (
    SELECT 1 FROM public.rfi_requests r
    WHERE r.id::text = (storage.foldername(name))[1]
      AND r.status IN ('draft', 'sent', 'viewed', 'submitted')
  )
  AND lower(name) ~ '\.(pdf|png|jpg|jpeg|webp|gif|heic|heif|doc|docx|xls|xlsx|csv|txt)$'
);
