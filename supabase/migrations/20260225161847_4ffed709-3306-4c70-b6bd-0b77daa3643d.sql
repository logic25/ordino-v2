-- Move the 3 system folders to be children of Beacon Knowledge Base
UPDATE document_folders
SET parent_id = '02ab6572-9b78-4d79-8b4a-bf172ccfc053'
WHERE id IN (
  '585497af-3f85-4380-b6b6-37e9e7f098ea',  -- Case Files & Precedents
  '89332131-89b1-475c-8783-d14089cafcff',  -- DOB Notices & Bulletins
  '9944db2f-73c8-4943-b36c-07ef592a2fc7'   -- Guides & SOPs
);

-- Also update the seed function to nest them correctly for new companies
CREATE OR REPLACE FUNCTION seed_document_folders(target_company_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  beacon_id uuid;
  dob_id uuid;
  guides_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM document_folders WHERE company_id = target_company_id) THEN
    RETURN;
  END IF;

  beacon_id := gen_random_uuid();
  dob_id := gen_random_uuid();
  guides_id := gen_random_uuid();

  INSERT INTO document_folders (id, company_id, name, parent_id, is_system, is_beacon_synced, description) VALUES
    (beacon_id, target_company_id, 'Beacon Knowledge Base', NULL, true, true, 'AI knowledge base — files here are auto-ingested into Beacon'),
    (gen_random_uuid(), target_company_id, 'Case Files & Precedents', beacon_id, true, false, NULL),
    (dob_id, target_company_id, 'DOB Notices & Bulletins', beacon_id, true, false, NULL),
    (gen_random_uuid(), target_company_id, 'Buildings Bulletins', dob_id, true, false, NULL),
    (gen_random_uuid(), target_company_id, 'Policy Memos', dob_id, true, false, NULL),
    (gen_random_uuid(), target_company_id, 'Service Notices', dob_id, true, false, NULL),
    (gen_random_uuid(), target_company_id, 'Technical Bulletins', dob_id, true, false, NULL),
    (guides_id, target_company_id, 'Guides & SOPs', beacon_id, true, false, NULL),
    (gen_random_uuid(), target_company_id, 'Code References', guides_id, true, false, NULL),
    (gen_random_uuid(), target_company_id, 'Company SOPs', guides_id, true, false, NULL),
    (gen_random_uuid(), target_company_id, 'Permit Filing Guides', guides_id, true, false, NULL),
    (gen_random_uuid(), target_company_id, 'Violation Guides', guides_id, true, false, NULL),
    (gen_random_uuid(), target_company_id, 'Zoning References', guides_id, true, false, NULL);
END;
$$;