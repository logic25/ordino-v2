
-- Phase 1: RFP Response Automation System

-- 1. Add RFP reference columns to dob_applications
ALTER TABLE public.dob_applications
  ADD COLUMN IF NOT EXISTS notable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rfp_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reference_contact_name text,
  ADD COLUMN IF NOT EXISTS reference_contact_title text,
  ADD COLUMN IF NOT EXISTS reference_contact_email text,
  ADD COLUMN IF NOT EXISTS reference_contact_phone text,
  ADD COLUMN IF NOT EXISTS reference_notes text,
  ADD COLUMN IF NOT EXISTS reference_last_verified timestamptz;

CREATE INDEX IF NOT EXISTS idx_dob_applications_rfp_tags ON public.dob_applications USING GIN(rfp_tags);
CREATE INDEX IF NOT EXISTS idx_dob_applications_notable ON public.dob_applications(notable) WHERE notable = true;

-- 2. Create rfp_content table
CREATE TABLE public.rfp_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] DEFAULT '{}',
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfp_content_company ON public.rfp_content(company_id);
CREATE INDEX idx_rfp_content_type ON public.rfp_content(content_type);
CREATE INDEX idx_rfp_content_tags ON public.rfp_content USING GIN(tags);

ALTER TABLE public.rfp_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view rfp_content"
  ON public.rfp_content FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Admins can manage rfp_content"
  ON public.rfp_content FOR ALL
  USING (is_company_admin(company_id))
  WITH CHECK (is_company_admin(company_id));

-- 3. Create rfps table
CREATE TABLE public.rfps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  agency text,
  rfp_number text,
  due_date timestamptz,
  status text NOT NULL DEFAULT 'prospect',
  uploaded_pdf_url text,
  requirements jsonb DEFAULT '{}'::jsonb,
  mwbe_goal_min numeric,
  mwbe_goal_max numeric,
  response_draft_url text,
  submitted_at timestamptz,
  outcome text,
  contract_value numeric,
  debrief_notes text,
  lessons_learned jsonb,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfps_company ON public.rfps(company_id);
CREATE INDEX idx_rfps_status ON public.rfps(status);
CREATE INDEX idx_rfps_agency ON public.rfps(agency);
CREATE INDEX idx_rfps_due_date ON public.rfps(due_date);

ALTER TABLE public.rfps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view rfps"
  ON public.rfps FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Admins can manage rfps"
  ON public.rfps FOR ALL
  USING (is_company_admin(company_id))
  WITH CHECK (is_company_admin(company_id));

-- 4. Create rfp_sections table
CREATE TABLE public.rfp_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id uuid NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
  section_type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_generated boolean DEFAULT false,
  reviewed boolean DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfp_sections_rfp ON public.rfp_sections(rfp_id);
CREATE INDEX idx_rfp_sections_order ON public.rfp_sections(rfp_id, display_order);

ALTER TABLE public.rfp_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view rfp_sections"
  ON public.rfp_sections FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rfps r WHERE r.id = rfp_id AND is_company_member(r.company_id)
  ));

CREATE POLICY "Admins can manage rfp_sections"
  ON public.rfp_sections FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.rfps r WHERE r.id = rfp_id AND is_company_admin(r.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rfps r WHERE r.id = rfp_id AND is_company_admin(r.company_id)
  ));

-- 5. Add rfps resource to role_permissions for all existing company/role combos
INSERT INTO public.role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
SELECT DISTINCT company_id, role, 'rfps',
  true, true, true,
  CASE WHEN role = 'admin'::app_role THEN true ELSE false END,
  CASE WHEN role = 'admin'::app_role THEN true ELSE false END,
  CASE WHEN role = 'admin'::app_role THEN true ELSE false END
FROM public.role_permissions
WHERE resource = 'projects'
ON CONFLICT DO NOTHING;

-- 6. Triggers for updated_at
CREATE TRIGGER update_rfp_content_updated_at
  BEFORE UPDATE ON public.rfp_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rfps_updated_at
  BEFORE UPDATE ON public.rfps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rfp_sections_updated_at
  BEFORE UPDATE ON public.rfp_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
