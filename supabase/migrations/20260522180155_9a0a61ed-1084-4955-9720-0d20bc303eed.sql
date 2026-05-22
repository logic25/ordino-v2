-- Track licensed jurisdictions (states) for firms and individual contacts.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS licensed_jurisdictions text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS licensed_jurisdictions text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_clients_licensed_jurisdictions
  ON public.clients USING GIN (licensed_jurisdictions);

CREATE INDEX IF NOT EXISTS idx_client_contacts_licensed_jurisdictions
  ON public.client_contacts USING GIN (licensed_jurisdictions);

COMMENT ON COLUMN public.clients.licensed_jurisdictions IS
  'US state codes (e.g. {NY,NJ,CT}) where this firm is licensed to practice. Empty = unknown.';
COMMENT ON COLUMN public.client_contacts.licensed_jurisdictions IS
  'US state codes (e.g. {NY,NJ}) where this individual holds an active license. Empty = unknown.';