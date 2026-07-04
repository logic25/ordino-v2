
-- ===== content_candidates =====
ALTER TABLE public.content_candidates ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.content_candidates SET company_id = (SELECT id FROM public.companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;
ALTER TABLE public.content_candidates ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.content_candidates ALTER COLUMN company_id SET DEFAULT public.current_user_company_id();
CREATE INDEX IF NOT EXISTS idx_content_candidates_company ON public.content_candidates(company_id);

DROP POLICY IF EXISTS "members read content candidates" ON public.content_candidates;
DROP POLICY IF EXISTS "members update content candidates" ON public.content_candidates;
DROP POLICY IF EXISTS "members insert content candidates" ON public.content_candidates;

CREATE POLICY "members read content candidates" ON public.content_candidates
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "members insert content candidates" ON public.content_candidates
  FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "members update content candidates" ON public.content_candidates
  FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "members delete content candidates" ON public.content_candidates
  FOR DELETE TO authenticated USING (public.is_company_member(company_id));

-- ===== generated_content =====
ALTER TABLE public.generated_content ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.generated_content gc SET company_id = COALESCE(
  (SELECT cc.company_id FROM public.content_candidates cc WHERE cc.id = gc.candidate_id),
  (SELECT id FROM public.companies ORDER BY created_at LIMIT 1)
) WHERE company_id IS NULL;
ALTER TABLE public.generated_content ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.generated_content ALTER COLUMN company_id SET DEFAULT public.current_user_company_id();
CREATE INDEX IF NOT EXISTS idx_generated_content_company ON public.generated_content(company_id);

DROP POLICY IF EXISTS "members read generated content" ON public.generated_content;
DROP POLICY IF EXISTS "members write generated content" ON public.generated_content;

CREATE POLICY "members read generated content" ON public.generated_content
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "members write generated content" ON public.generated_content
  FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

-- ===== kb_deleted_documents =====
ALTER TABLE public.kb_deleted_documents ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.kb_deleted_documents SET company_id = (SELECT id FROM public.companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;
ALTER TABLE public.kb_deleted_documents ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.kb_deleted_documents ALTER COLUMN company_id SET DEFAULT public.current_user_company_id();
CREATE INDEX IF NOT EXISTS idx_kb_deleted_documents_company ON public.kb_deleted_documents(company_id);

DROP POLICY IF EXISTS "members read deleted kb docs" ON public.kb_deleted_documents;
DROP POLICY IF EXISTS "members manage deleted kb docs" ON public.kb_deleted_documents;

CREATE POLICY "members read deleted kb docs" ON public.kb_deleted_documents
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "members insert deleted kb docs" ON public.kb_deleted_documents
  FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "members delete deleted kb docs" ON public.kb_deleted_documents
  FOR DELETE TO authenticated USING (public.is_company_member(company_id));

-- ===== beacon tables: remove cross-tenant admin policies =====
DROP POLICY IF EXISTS "admins read beacon suggestions" ON public.beacon_suggestions;
DROP POLICY IF EXISTS "admins review beacon suggestions" ON public.beacon_suggestions;
DROP POLICY IF EXISTS "admins read beacon api usage" ON public.beacon_api_usage;
DROP POLICY IF EXISTS "admins read beacon feedback" ON public.beacon_feedback;
DROP POLICY IF EXISTS "admins read beacon interactions" ON public.beacon_interactions;

-- ===== permit-playbooks storage: enforce company path scoping =====
DROP POLICY IF EXISTS "permit_playbooks_read" ON storage.objects;
DROP POLICY IF EXISTS "permit_playbooks_insert" ON storage.objects;
DROP POLICY IF EXISTS "permit_playbooks_update" ON storage.objects;
DROP POLICY IF EXISTS "permit_playbooks_delete" ON storage.objects;

CREATE POLICY "permit_playbooks_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'permit-playbooks'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_company_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "permit_playbooks_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'permit-playbooks'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_company_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "permit_playbooks_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'permit-playbooks'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_company_member(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'permit-playbooks'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_company_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "permit_playbooks_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'permit-playbooks'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_company_member(((storage.foldername(name))[1])::uuid)
  );
