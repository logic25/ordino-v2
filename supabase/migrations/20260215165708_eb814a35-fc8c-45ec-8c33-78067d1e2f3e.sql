
-- ============================================
-- RFP Discovery Module: Phase 1 Tables
-- ============================================

-- 1. RFP Sources - procurement portals to monitor
CREATE TABLE public.rfp_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  source_url text NOT NULL,
  source_type text NOT NULL DEFAULT 'html', -- rss, api, html
  check_frequency text NOT NULL DEFAULT 'daily', -- daily, twice_daily, weekly
  last_checked_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rfp_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view rfp_sources"
  ON public.rfp_sources FOR SELECT
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Company members can insert rfp_sources"
  ON public.rfp_sources FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Company members can update rfp_sources"
  ON public.rfp_sources FOR UPDATE
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Company members can delete rfp_sources"
  ON public.rfp_sources FOR DELETE
  USING (company_id = public.get_user_company_id());

-- 2. Discovered RFPs - RFPs found by the monitoring system
CREATE TABLE public.discovered_rfps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.rfp_sources(id) ON DELETE SET NULL,
  title text NOT NULL,
  rfp_number text,
  issuing_agency text,
  due_date timestamptz,
  original_url text,
  pdf_url text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  relevance_score numeric,
  relevance_reason text,
  service_tags text[] DEFAULT '{}',
  estimated_value numeric,
  status text NOT NULL DEFAULT 'new', -- new, reviewing, preparing, passed, archived
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  rfp_id uuid REFERENCES public.rfps(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_discovered_rfps_company ON public.discovered_rfps(company_id);
CREATE INDEX idx_discovered_rfps_status ON public.discovered_rfps(status);

ALTER TABLE public.discovered_rfps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view discovered_rfps"
  ON public.discovered_rfps FOR SELECT
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Company members can insert discovered_rfps"
  ON public.discovered_rfps FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Company members can update discovered_rfps"
  ON public.discovered_rfps FOR UPDATE
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Company members can delete discovered_rfps"
  ON public.discovered_rfps FOR DELETE
  USING (company_id = public.get_user_company_id());

-- Trigger for updated_at
CREATE TRIGGER update_discovered_rfps_updated_at
  BEFORE UPDATE ON public.discovered_rfps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RFP Monitoring Rules - company-specific matching criteria
CREATE TABLE public.rfp_monitoring_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  keyword_include text[] DEFAULT '{}',
  keyword_exclude text[] DEFAULT '{}',
  agencies_include text[] DEFAULT '{}',
  min_relevance_score integer NOT NULL DEFAULT 60,
  notify_email boolean NOT NULL DEFAULT true,
  email_recipients text[] DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rfp_monitoring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view rfp_monitoring_rules"
  ON public.rfp_monitoring_rules FOR SELECT
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Company members can insert rfp_monitoring_rules"
  ON public.rfp_monitoring_rules FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Company members can update rfp_monitoring_rules"
  ON public.rfp_monitoring_rules FOR UPDATE
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Company members can delete rfp_monitoring_rules"
  ON public.rfp_monitoring_rules FOR DELETE
  USING (company_id = public.get_user_company_id());

-- 4. Add discovered_from_id to rfps table
ALTER TABLE public.rfps ADD COLUMN IF NOT EXISTS discovered_from_id uuid REFERENCES public.discovered_rfps(id) ON DELETE SET NULL;

-- 5. Add theme JSONB column to companies for brand customization
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS theme jsonb DEFAULT null;
