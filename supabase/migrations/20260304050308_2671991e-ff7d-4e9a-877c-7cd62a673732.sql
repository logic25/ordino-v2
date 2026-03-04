
-- Delete all existing child folders under "Beacon Knowledge Base"
DELETE FROM public.document_folders
WHERE parent_id IN (
  SELECT id FROM public.document_folders WHERE name = 'Beacon Knowledge Base' AND parent_id IS NULL
);

-- Also delete grandchildren (nested subfolders)
-- (already covered since parent cascade, but just in case)

-- Now insert the 9 new flat folders under Beacon Knowledge Base
INSERT INTO public.document_folders (id, company_id, name, parent_id, is_system, is_beacon_synced, description)
SELECT
  gen_random_uuid(),
  bkb.company_id,
  folder.name,
  bkb.id,
  true,
  true,
  folder.description
FROM public.document_folders bkb
CROSS JOIN (VALUES
  ('Filing Guides', 'Step-by-step instructions, decision trees, reference guides, how to file with DOB'),
  ('Service Notices', 'Official DOB announcements about system/fee/procedure changes'),
  ('Buildings Bulletins', 'Official DOB technical guidance on code interpretation'),
  ('Policy Memos', 'DOB policy decisions, fact sheets, acceptance letters'),
  ('Codes', 'Actual legal text — Building Code, MDL, RCNY, Zoning Resolution, HMC, Energy Code'),
  ('Determinations', 'Real DOB decisions on specific jobs (reconsiderations, acceptances)'),
  ('Company SOPs', 'Internal GLE processes, communication patterns, institutional knowledge'),
  ('Objections', 'Objection handling processes and guides')
) AS folder(name, description)
WHERE bkb.name = 'Beacon Knowledge Base' AND bkb.parent_id IS NULL
ON CONFLICT DO NOTHING;
