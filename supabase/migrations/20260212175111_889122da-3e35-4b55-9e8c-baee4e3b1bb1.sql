
-- 1. gmail_connections
CREATE TABLE public.gmail_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_address varchar NOT NULL,
  refresh_token text,
  access_token text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  history_id varchar,
  sync_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gmail connections"
  ON public.gmail_connections FOR SELECT
  USING (is_company_member(company_id) AND user_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1));

CREATE POLICY "Users can insert own gmail connections"
  ON public.gmail_connections FOR INSERT
  WITH CHECK (is_company_member(company_id) AND user_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1));

CREATE POLICY "Users can update own gmail connections"
  ON public.gmail_connections FOR UPDATE
  USING (is_company_member(company_id) AND user_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1));

CREATE POLICY "Users can delete own gmail connections"
  ON public.gmail_connections FOR DELETE
  USING (is_company_member(company_id) AND user_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1));

CREATE UNIQUE INDEX idx_gmail_connections_user ON public.gmail_connections(user_id);

-- 2. emails
CREATE TABLE public.emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gmail_message_id varchar NOT NULL,
  thread_id varchar,
  subject text,
  from_email varchar,
  from_name varchar,
  to_emails jsonb DEFAULT '[]'::jsonb,
  date timestamptz,
  body_text text,
  body_html text,
  snippet text,
  has_attachments boolean NOT NULL DEFAULT false,
  labels jsonb DEFAULT '[]'::jsonb,
  is_read boolean NOT NULL DEFAULT true,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company isolation for emails"
  ON public.emails FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can insert emails"
  ON public.emails FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "Admins and managers can update emails"
  ON public.emails FOR UPDATE
  USING (is_admin_or_manager(company_id));

CREATE POLICY "Admins and managers can delete emails"
  ON public.emails FOR DELETE
  USING (is_admin_or_manager(company_id));

CREATE UNIQUE INDEX idx_emails_gmail_id_company ON public.emails(gmail_message_id, company_id);
CREATE INDEX idx_emails_thread ON public.emails(thread_id);
CREATE INDEX idx_emails_date ON public.emails(date DESC);
CREATE INDEX idx_emails_company ON public.emails(company_id);

-- 3. email_project_tags
CREATE TABLE public.email_project_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id uuid NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tagged_by_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category varchar NOT NULL DEFAULT 'other',
  notes text,
  tagged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_project_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company isolation for email_project_tags"
  ON public.email_project_tags FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can tag emails"
  ON public.email_project_tags FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "Admins managers can update tags"
  ON public.email_project_tags FOR UPDATE
  USING (is_admin_or_manager(company_id));

CREATE POLICY "Admins managers can delete tags"
  ON public.email_project_tags FOR DELETE
  USING (is_admin_or_manager(company_id) OR tagged_by_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1));

CREATE UNIQUE INDEX idx_email_project_tag_unique ON public.email_project_tags(email_id, project_id);
CREATE INDEX idx_email_tags_project ON public.email_project_tags(project_id);
CREATE INDEX idx_email_tags_email ON public.email_project_tags(email_id);

-- 4. email_attachments
CREATE TABLE public.email_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id uuid NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  filename varchar NOT NULL,
  mime_type varchar,
  size_bytes integer,
  gmail_attachment_id varchar,
  saved_to_project boolean NOT NULL DEFAULT false,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company isolation for email_attachments"
  ON public.email_attachments FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can insert email_attachments"
  ON public.email_attachments FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "Admins managers can update email_attachments"
  ON public.email_attachments FOR UPDATE
  USING (is_admin_or_manager(company_id));

CREATE POLICY "Admins managers can delete email_attachments"
  ON public.email_attachments FOR DELETE
  USING (is_admin_or_manager(company_id));

CREATE INDEX idx_email_attachments_email ON public.email_attachments(email_id);

-- Triggers for updated_at
CREATE TRIGGER update_gmail_connections_updated_at
  BEFORE UPDATE ON public.gmail_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
