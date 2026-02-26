-- Allow anon to read company info when accessing a public change order
CREATE POLICY "anon_read_company_via_co"
  ON public.companies FOR SELECT TO anon
  USING (
    id IN (SELECT company_id FROM public.change_orders WHERE public_token IS NOT NULL)
  );

-- Allow anon to read project info when accessing a public change order
CREATE POLICY "anon_read_project_via_co"
  ON public.projects FOR SELECT TO anon
  USING (
    id IN (SELECT project_id FROM public.change_orders WHERE public_token IS NOT NULL)
  );

-- Allow anon to read property info for projects linked to public change orders
CREATE POLICY "anon_read_property_via_co"
  ON public.properties FOR SELECT TO anon
  USING (
    id IN (
      SELECT p.property_id FROM public.projects p
      JOIN public.change_orders co ON co.project_id = p.id
      WHERE co.public_token IS NOT NULL
    )
  );

-- Allow anon to read client name for projects linked to public change orders
CREATE POLICY "anon_read_client_via_co"
  ON public.clients FOR SELECT TO anon
  USING (
    id IN (
      SELECT p.client_id FROM public.projects p
      JOIN public.change_orders co ON co.project_id = p.id
      WHERE co.public_token IS NOT NULL AND p.client_id IS NOT NULL
    )
  );