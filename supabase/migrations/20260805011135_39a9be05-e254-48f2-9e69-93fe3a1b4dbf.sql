CREATE TABLE public.client_duplicate_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id_low uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_id_high uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_duplicate_exclusions_ordered CHECK (client_id_low < client_id_high),
  CONSTRAINT client_duplicate_exclusions_unique_pair UNIQUE (company_id, client_id_low, client_id_high)
);

GRANT SELECT, INSERT, DELETE ON public.client_duplicate_exclusions TO authenticated;
GRANT ALL ON public.client_duplicate_exclusions TO service_role;

ALTER TABLE public.client_duplicate_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view duplicate exclusions"
ON public.client_duplicate_exclusions
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));

CREATE POLICY "Company members can create duplicate exclusions"
ON public.client_duplicate_exclusions
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_company_member(company_id)
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_id_low AND c.company_id = client_duplicate_exclusions.company_id
  )
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_id_high AND c.company_id = client_duplicate_exclusions.company_id
  )
);

CREATE POLICY "Creators or managers can remove duplicate exclusions"
ON public.client_duplicate_exclusions
FOR DELETE
TO authenticated
USING (
  public.is_company_member(company_id)
  AND (
    created_by = auth.uid()
    OR public.has_app_role(auth.uid(), 'admin')
    OR public.has_app_role(auth.uid(), 'manager')
  )
);

CREATE INDEX client_duplicate_exclusions_company_idx
ON public.client_duplicate_exclusions(company_id);
