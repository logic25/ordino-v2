
CREATE TABLE public.concierge_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_contact_id UUID REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  sender_email TEXT,
  sender_verified BOOLEAN NOT NULL DEFAULT false,
  inbound_subject TEXT,
  inbound_text TEXT,
  matched_intent TEXT,
  intent_confidence NUMERIC,
  outbound_text TEXT,
  escalated BOOLEAN NOT NULL DEFAULT false,
  pm_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_concierge_conv_company ON public.concierge_conversations(company_id, created_at DESC);
CREATE INDEX idx_concierge_conv_client ON public.concierge_conversations(client_id, created_at DESC);
CREATE INDEX idx_concierge_conv_project ON public.concierge_conversations(project_id, created_at DESC);
CREATE INDEX idx_concierge_conv_sender_day ON public.concierge_conversations(sender_email, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.concierge_conversations TO authenticated;
GRANT ALL ON public.concierge_conversations TO service_role;

ALTER TABLE public.concierge_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view concierge conversations"
  ON public.concierge_conversations FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert concierge conversations"
  ON public.concierge_conversations FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update concierge conversations"
  ON public.concierge_conversations FOR UPDATE
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
