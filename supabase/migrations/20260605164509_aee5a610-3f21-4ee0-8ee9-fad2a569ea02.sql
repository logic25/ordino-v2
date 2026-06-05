
-- ============================================================
-- Fix: expense-receipts bucket — scope by company folder
-- Paths are stored as `${company_id}/<uuid>.<ext>`
-- ============================================================
DROP POLICY IF EXISTS "Auth users can upload expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can read expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete expense receipts" ON storage.objects;

CREATE POLICY "Company members can upload expense receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
  );

CREATE POLICY "Company members can read expense receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
  );

CREATE POLICY "Company members can update expense receipts"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
  );

CREATE POLICY "Company members can delete expense receipts"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
  );

-- ============================================================
-- Fix: rfi-attachments bucket — scope SELECT/DELETE by parent RFI's company
-- Paths are stored as `${rfi_id}/<filename>`
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view RFI attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete RFI attachments" ON storage.objects;

CREATE POLICY "Company members can view RFI attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'rfi-attachments'
    AND EXISTS (
      SELECT 1 FROM public.rfi_requests r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND r.company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "Company members can delete RFI attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'rfi-attachments'
    AND EXISTS (
      SELECT 1 FROM public.rfi_requests r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND r.company_id = public.get_user_company_id()
    )
  );
