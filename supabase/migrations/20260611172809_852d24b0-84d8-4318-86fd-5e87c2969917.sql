
CREATE OR REPLACE FUNCTION public.can_modify_operations(target_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND company_id = target_company_id
      AND role IN ('admin', 'manager', 'production')
      AND is_active = true
  )
$$;

DROP POLICY IF EXISTS "Admins and managers can modify proposals" ON public.proposals;
CREATE POLICY "Operations can modify proposals" ON public.proposals
  FOR ALL USING (can_modify_operations(company_id)) WITH CHECK (can_modify_operations(company_id));

DROP POLICY IF EXISTS "Admins and managers can modify proposal items" ON public.proposal_items;
CREATE POLICY "Operations can modify proposal items" ON public.proposal_items
  FOR ALL USING (can_modify_operations((SELECT company_id FROM public.proposals WHERE id = proposal_id)))
  WITH CHECK (can_modify_operations((SELECT company_id FROM public.proposals WHERE id = proposal_id)));

DROP POLICY IF EXISTS "Admins and managers can modify proposal milestones" ON public.proposal_milestones;
CREATE POLICY "Operations can modify proposal milestones" ON public.proposal_milestones
  FOR ALL USING (can_modify_operations((SELECT company_id FROM public.proposals WHERE id = proposal_id)))
  WITH CHECK (can_modify_operations((SELECT company_id FROM public.proposals WHERE id = proposal_id)));

DROP POLICY IF EXISTS "Admins and managers can modify proposal contacts" ON public.proposal_contacts;
CREATE POLICY "Operations can modify proposal contacts" ON public.proposal_contacts
  FOR ALL USING (can_modify_operations((SELECT company_id FROM public.proposals WHERE id = proposal_id)))
  WITH CHECK (can_modify_operations((SELECT company_id FROM public.proposals WHERE id = proposal_id)));

DROP POLICY IF EXISTS "Admins and managers can modify projects" ON public.projects;
CREATE POLICY "Operations can modify projects" ON public.projects
  FOR ALL USING (can_modify_operations(company_id)) WITH CHECK (can_modify_operations(company_id));

DROP POLICY IF EXISTS "Admins and managers can modify clients" ON public.clients;
CREATE POLICY "Operations can modify clients" ON public.clients
  FOR ALL USING (can_modify_operations(company_id)) WITH CHECK (can_modify_operations(company_id));

DROP POLICY IF EXISTS "Admins and managers can modify client_contacts" ON public.client_contacts;
CREATE POLICY "Operations can modify client_contacts" ON public.client_contacts
  FOR ALL USING (can_modify_operations(company_id)) WITH CHECK (can_modify_operations(company_id));

DROP POLICY IF EXISTS "Admins and managers can modify properties" ON public.properties;
CREATE POLICY "Operations can modify properties" ON public.properties
  FOR ALL USING (can_modify_operations(company_id)) WITH CHECK (can_modify_operations(company_id));

DROP POLICY IF EXISTS "Admins and managers can modify applications" ON public.dob_applications;
CREATE POLICY "Operations can modify applications" ON public.dob_applications
  FOR ALL USING (can_modify_operations(company_id)) WITH CHECK (can_modify_operations(company_id));

DROP POLICY IF EXISTS "Admins managers and accounting can modify services" ON public.services;
CREATE POLICY "Operations and accounting can modify services" ON public.services
  FOR ALL USING (can_modify_operations(company_id) OR has_role(company_id, 'accounting'::user_role))
  WITH CHECK (can_modify_operations(company_id) OR has_role(company_id, 'accounting'::user_role));

DROP POLICY IF EXISTS "Admins and managers can modify rfi_templates" ON public.rfi_templates;
CREATE POLICY "Operations can modify rfi_templates" ON public.rfi_templates
  FOR ALL USING (can_modify_operations(company_id)) WITH CHECK (can_modify_operations(company_id));

DROP POLICY IF EXISTS "Admins and managers can modify rfi_requests" ON public.rfi_requests;
CREATE POLICY "Operations can modify rfi_requests" ON public.rfi_requests
  FOR ALL USING (can_modify_operations(company_id)) WITH CHECK (can_modify_operations(company_id));

INSERT INTO public.changelog_entries (company_id, date, title, description, tag)
SELECT DISTINCT company_id, CURRENT_DATE,
  'Production role can now create proposals & projects',
  'Fixed a permissions bug where production users (like Sheri) hit a row-level security error when creating proposals. Production now has the same write access as admins/managers for proposals, projects, clients, properties, RFIs, DOB filings, and services. Financial tables (invoices, billing, retainers) remain admin/manager/accounting only.',
  'fix'
FROM public.profiles WHERE company_id IS NOT NULL;
