
DO $$
DECLARE
  c RECORD;
  root_id uuid;
  shared_id uuid;
  jur_id uuid;
  nyc_id uuid;
  company_sops_id uuid;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    -- Find or create root "Beacon Knowledge Base"
    SELECT id INTO root_id FROM public.document_folders
      WHERE company_id = c.id AND parent_id IS NULL AND name = 'Beacon Knowledge Base' LIMIT 1;
    IF root_id IS NULL THEN
      INSERT INTO public.document_folders (company_id, name, parent_id, is_system, is_beacon_synced, default_jurisdiction, description)
        VALUES (c.id, 'Beacon Knowledge Base', NULL, true, true, 'universal', 'AI knowledge base — files here are auto-ingested into Beacon')
        RETURNING id INTO root_id;
    END IF;

    -- Shared / Company
    SELECT id INTO shared_id FROM public.document_folders
      WHERE company_id = c.id AND parent_id = root_id AND name = 'Shared / Company' LIMIT 1;
    IF shared_id IS NULL THEN
      INSERT INTO public.document_folders (company_id, name, parent_id, is_system, is_beacon_synced, default_jurisdiction, description)
        VALUES (c.id, 'Shared / Company', root_id, true, false, 'universal', 'Cross-jurisdiction company & platform knowledge')
        RETURNING id INTO shared_id;
    ELSE
      UPDATE public.document_folders SET default_jurisdiction = 'universal' WHERE id = shared_id;
    END IF;

    -- Jurisdictions
    SELECT id INTO jur_id FROM public.document_folders
      WHERE company_id = c.id AND parent_id = root_id AND name = 'Jurisdictions' LIMIT 1;
    IF jur_id IS NULL THEN
      INSERT INTO public.document_folders (company_id, name, parent_id, is_system, is_beacon_synced, default_jurisdiction, description)
        VALUES (c.id, 'Jurisdictions', root_id, true, false, 'universal', 'Jurisdiction-specific knowledge (add a new market by creating a folder here)')
        RETURNING id INTO jur_id;
    END IF;

    -- NYC / DOB
    SELECT id INTO nyc_id FROM public.document_folders
      WHERE company_id = c.id AND parent_id = jur_id AND name = 'NYC / DOB' LIMIT 1;
    IF nyc_id IS NULL THEN
      INSERT INTO public.document_folders (company_id, name, parent_id, is_system, is_beacon_synced, default_jurisdiction, description)
        VALUES (c.id, 'NYC / DOB', jur_id, true, false, 'NYC', 'New York City — Department of Buildings')
        RETURNING id INTO nyc_id;
    ELSE
      UPDATE public.document_folders SET default_jurisdiction = 'NYC' WHERE id = nyc_id;
    END IF;

    -- Re-parent existing NYC category folders under NYC / DOB; force NYC jurisdiction
    UPDATE public.document_folders
      SET parent_id = nyc_id, default_jurisdiction = 'NYC'
      WHERE company_id = c.id
        AND name IN ('Codes','Filing Guides','Buildings Bulletins','Determinations','Objections','Policy Memos','Service Notices')
        AND parent_id IS DISTINCT FROM nyc_id;

    -- Playbooks (new) under NYC / DOB
    IF NOT EXISTS (SELECT 1 FROM public.document_folders WHERE company_id = c.id AND parent_id = nyc_id AND name = 'Playbooks') THEN
      INSERT INTO public.document_folders (company_id, name, parent_id, is_system, is_beacon_synced, default_jurisdiction, description)
        VALUES (c.id, 'Playbooks', nyc_id, true, false, 'NYC', 'Per-permit-type playbooks (Alt-1, PW1, sign, CO, …)');
    END IF;

    -- Move Company SOPs under Shared / Company
    SELECT id INTO company_sops_id FROM public.document_folders
      WHERE company_id = c.id AND name = 'Company SOPs' LIMIT 1;
    IF company_sops_id IS NOT NULL THEN
      UPDATE public.document_folders
        SET parent_id = shared_id, default_jurisdiction = 'universal'
        WHERE id = company_sops_id;
      -- Retag docs in Company SOPs to universal
      UPDATE public.universal_documents SET jurisdiction = 'universal' WHERE folder_id = company_sops_id;
    END IF;

    -- Platform SOPs (new) under Shared / Company
    IF NOT EXISTS (SELECT 1 FROM public.document_folders WHERE company_id = c.id AND parent_id = shared_id AND name = 'Platform SOPs') THEN
      INSERT INTO public.document_folders (company_id, name, parent_id, is_system, is_beacon_synced, default_jurisdiction, description)
        VALUES (c.id, 'Platform SOPs', shared_id, true, false, 'universal', 'Platform/tool SOPs (Accela, Tyler EnerGov, …)');
    END IF;
  END LOOP;
END $$;

-- Update seed function for new companies
CREATE OR REPLACE FUNCTION public.seed_document_folders(target_company_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  root_id uuid;
  shared_id uuid;
  jur_id uuid;
  nyc_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM document_folders WHERE company_id = target_company_id) THEN
    RETURN;
  END IF;

  root_id := gen_random_uuid();
  shared_id := gen_random_uuid();
  jur_id := gen_random_uuid();
  nyc_id := gen_random_uuid();

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
    (gen_random_uuid(), target_company_id, 'Playbooks',           nyc_id, true, false, 'NYC', 'Per-permit-type playbooks (Alt-1, PW1, sign, CO, …)');
END;
$$;
