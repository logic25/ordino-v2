CREATE TABLE public.beacon_kb_folder_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_file text NOT NULL,
  display_folder text NOT NULL,
  hidden_from_original boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, source_file)
);

CREATE INDEX idx_beacon_kb_overrides_company ON public.beacon_kb_folder_overrides(company_id);
CREATE INDEX idx_beacon_kb_overrides_source_file ON public.beacon_kb_folder_overrides(source_file);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.beacon_kb_folder_overrides TO authenticated;
GRANT ALL ON public.beacon_kb_folder_overrides TO service_role;

ALTER TABLE public.beacon_kb_folder_overrides ENABLE ROW LEVEL SECURITY;

-- Admins and managers in the same company can read overrides
CREATE POLICY "Admins/managers can view overrides in their company"
  ON public.beacon_kb_folder_overrides
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

-- Admins and managers can insert
CREATE POLICY "Admins/managers can create overrides in their company"
  ON public.beacon_kb_folder_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

-- Admins and managers can update
CREATE POLICY "Admins/managers can update overrides in their company"
  ON public.beacon_kb_folder_overrides
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

-- Admins and managers can delete
CREATE POLICY "Admins/managers can delete overrides in their company"
  ON public.beacon_kb_folder_overrides
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

CREATE TRIGGER update_beacon_kb_overrides_updated_at
  BEFORE UPDATE ON public.beacon_kb_folder_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();