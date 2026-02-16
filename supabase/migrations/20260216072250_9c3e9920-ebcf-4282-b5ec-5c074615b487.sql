
ALTER TABLE public.projects
  ADD COLUMN unit_number varchar DEFAULT NULL,
  ADD COLUMN tenant_name text DEFAULT NULL;
