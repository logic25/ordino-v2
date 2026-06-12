
-- Storage policies for permit-playbooks bucket
DO $$
BEGIN
  -- Drop existing if any
  EXECUTE 'DROP POLICY IF EXISTS "permit_playbooks_read" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "permit_playbooks_insert" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "permit_playbooks_update" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "permit_playbooks_delete" ON storage.objects';
END $$;

CREATE POLICY "permit_playbooks_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'permit-playbooks');

CREATE POLICY "permit_playbooks_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'permit-playbooks');

CREATE POLICY "permit_playbooks_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'permit-playbooks')
WITH CHECK (bucket_id = 'permit-playbooks');

CREATE POLICY "permit_playbooks_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'permit-playbooks');
