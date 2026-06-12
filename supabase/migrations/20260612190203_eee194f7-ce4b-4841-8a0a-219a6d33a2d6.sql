
-- 1. Remove empty Playbooks folders (only if no documents in them)
DELETE FROM public.document_folders f
WHERE f.name = 'Playbooks'
  AND f.is_system = true
  AND NOT EXISTS (SELECT 1 FROM public.universal_documents d WHERE d.folder_id = f.id)
  AND EXISTS (
    SELECT 1 FROM public.document_folders p
    WHERE p.id = f.parent_id AND p.name = 'NYC / DOB'
  );

-- 2. Create Project Documents tree per company and auto-file existing docs
DO $$
DECLARE
  c RECORD;
  pd_id uuid;
  signed_id uuid;
  plans_id uuid;
  co_id uuid;
  cho_id uuid;
  gen_id uuid;
BEGIN
  FOR c IN SELECT DISTINCT company_id FROM public.document_folders LOOP
    -- Skip if already exists
    IF EXISTS (SELECT 1 FROM public.document_folders WHERE company_id = c.company_id AND name = 'Project Documents' AND parent_id IS NULL) THEN
      CONTINUE;
    END IF;

    pd_id := gen_random_uuid();
    signed_id := gen_random_uuid();
    plans_id := gen_random_uuid();
    co_id := gen_random_uuid();
    cho_id := gen_random_uuid();
    gen_id := gen_random_uuid();

    INSERT INTO public.document_folders (id, company_id, name, parent_id, is_system, is_beacon_synced, default_jurisdiction, description) VALUES
      (pd_id,     c.company_id, 'Project Documents', NULL,  true, false, 'NYC', 'Operational project files — never synced to Beacon'),
      (signed_id, c.company_id, 'Signed Proposals',  pd_id, true, false, 'NYC', NULL),
      (plans_id,  c.company_id, 'Plans',             pd_id, true, false, 'NYC', NULL),
      (co_id,     c.company_id, 'CO Reports',        pd_id, true, false, 'NYC', NULL),
      (cho_id,    c.company_id, 'Change Orders',     pd_id, true, false, 'NYC', NULL),
      (gen_id,    c.company_id, 'General',           pd_id, true, false, 'NYC', NULL);

    -- Auto-file existing unfiled docs by category
    UPDATE public.universal_documents SET folder_id = signed_id
      WHERE company_id = c.company_id AND folder_id IS NULL AND category = 'contract';
    UPDATE public.universal_documents SET folder_id = plans_id
      WHERE company_id = c.company_id AND folder_id IS NULL AND category = 'Plans';
    UPDATE public.universal_documents SET folder_id = co_id
      WHERE company_id = c.company_id AND folder_id IS NULL AND category = 'CO Report';
    UPDATE public.universal_documents SET folder_id = cho_id
      WHERE company_id = c.company_id AND folder_id IS NULL AND category = 'change_order';
    UPDATE public.universal_documents SET folder_id = gen_id
      WHERE company_id = c.company_id AND folder_id IS NULL;
  END LOOP;
END $$;

-- 3. Update seed function
CREATE OR REPLACE FUNCTION public.seed_document_folders(target_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  root_id uuid;
  shared_id uuid;
  jur_id uuid;
  nyc_id uuid;
  pd_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM document_folders WHERE company_id = target_company_id) THEN
    RETURN;
  END IF;

  root_id := gen_random_uuid();
  shared_id := gen_random_uuid();
  jur_id := gen_random_uuid();
  nyc_id := gen_random_uuid();
  pd_id := gen_random_uuid();

  INSERT INTO document_folders (id, company_id, name, parent_id, is_system, is_beacon_synced, default_jurisdiction, description) VALUES
    (root_id,   target_company_id, 'Beacon Knowledge Base', NULL,      true, true,  'universal', 'AI knowledge base — files here are auto-ingested into Beacon'),
    (shared_id, target_company_id, 'Shared / Company',      root_id,   true, false, 'universal', 'Cross-jurisdiction company & platform knowledge'),
    (gen_random_uuid(), target_company_id, 'Company SOPs',  shared_id, true, false, 'universal', NULL),
    (gen_random_uuid(), target_company_id, 'Platform SOPs', shared_id, true, false, 'universal', 'Platform/tool SOPs (Accela, Tyler EnerGov, …)'),
    (jur_id,    target_company_id, 'Jurisdictions',         root_id,   true, false, 'universal', 'Jurisdiction-specific knowledge (add a new market by creating a folder here)'),
    (nyc_id,    target_company_id, 'NYC / DOB',             jur_id,    true, false, 'NYC',       'New York City — Department of Buildings'),
    (gen_random_uuid(), target_company_id, 'Codes',               nyc_id, true, false, 'NYC', NULL),
    (gen_random_uuid(), target_company_id, 'Filing Guides',       nyc_id, true, false, 'NYC', NULL),
    (gen_random_uuid(), target_company_id, 'Buildings Bulletins', nyc_id, true, false, 'NYC', NULL),
    (gen_random_uuid(), target_company_id, 'Determinations',      nyc_id, true, false, 'NYC', NULL),
    (gen_random_uuid(), target_company_id, 'Objections',          nyc_id, true, false, 'NYC', NULL),
    (gen_random_uuid(), target_company_id, 'Policy Memos',        nyc_id, true, false, 'NYC', NULL),
    (gen_random_uuid(), target_company_id, 'Service Notices',     nyc_id, true, false, 'NYC', NULL),
    (pd_id,     target_company_id, 'Project Documents',   NULL,   true, false, 'NYC', 'Operational project files — never synced to Beacon'),
    (gen_random_uuid(), target_company_id, 'Signed Proposals',    pd_id,  true, false, 'NYC', NULL),
    (gen_random_uuid(), target_company_id, 'Plans',               pd_id,  true, false, 'NYC', NULL),
    (gen_random_uuid(), target_company_id, 'CO Reports',          pd_id,  true, false, 'NYC', NULL),
    (gen_random_uuid(), target_company_id, 'Change Orders',       pd_id,  true, false, 'NYC', NULL),
    (gen_random_uuid(), target_company_id, 'General',             pd_id,  true, false, 'NYC', NULL);
END;
$function$;
