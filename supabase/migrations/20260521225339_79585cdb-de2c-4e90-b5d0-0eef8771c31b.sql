ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS specialty_tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS internal_notes text;

CREATE INDEX IF NOT EXISTS idx_clients_specialty_tags ON public.clients USING GIN (specialty_tags);