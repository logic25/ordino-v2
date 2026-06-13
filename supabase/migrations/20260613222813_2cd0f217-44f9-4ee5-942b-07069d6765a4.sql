-- content_candidates
DROP POLICY IF EXISTS "members read content candidates" ON public.content_candidates;
DROP POLICY IF EXISTS "members insert content candidates" ON public.content_candidates;
DROP POLICY IF EXISTS "members update content candidates" ON public.content_candidates;

CREATE POLICY "members read content candidates" ON public.content_candidates
  FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "members insert content candidates" ON public.content_candidates
  FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "members update content candidates" ON public.content_candidates
  FOR UPDATE TO authenticated USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));

-- generated_content
DROP POLICY IF EXISTS "members read generated content" ON public.generated_content;
DROP POLICY IF EXISTS "members write generated content" ON public.generated_content;

CREATE POLICY "members read generated content" ON public.generated_content
  FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "members write generated content" ON public.generated_content
  FOR ALL TO authenticated USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));