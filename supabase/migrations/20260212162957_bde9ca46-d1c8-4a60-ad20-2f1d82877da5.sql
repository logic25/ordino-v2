-- Contacts belonging to a client (company)
CREATE TABLE public.client_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  name VARCHAR NOT NULL,
  title VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company isolation for client_contacts"
  ON public.client_contacts FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Admins and managers can modify client_contacts"
  ON public.client_contacts FOR ALL
  USING (is_admin_or_manager(company_id));

CREATE TRIGGER update_client_contacts_updated_at
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();