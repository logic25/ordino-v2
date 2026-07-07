
ALTER TABLE public.client_orgs
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS client_orgs_client_id_unique
  ON public.client_orgs(client_id) WHERE client_id IS NOT NULL;
