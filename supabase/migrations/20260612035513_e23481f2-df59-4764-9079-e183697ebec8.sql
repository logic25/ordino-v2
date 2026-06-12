CREATE TABLE IF NOT EXISTS public.jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  state TEXT,
  status TEXT NOT NULL DEFAULT 'researching'
    CHECK (status IN ('researching','candidate','validating','live','rejected')),
  tier SMALLINT CHECK (tier BETWEEN 1 AND 3),
  portal_url TEXT,
  portal_platform TEXT,
  online_filing BOOLEAN,
  plans_upload_online BOOLEAN,
  online_payments BOOLEAN,
  inspection_scheduling_online BOOLEAN,
  license_required BOOLEAN,
  owner_auth_sufficient BOOLEAN,
  annual_permits INTEGER,
  permit_trend TEXT CHECK (permit_trend IN ('increasing','flat','decreasing')),
  open_data_url TEXT,
  open_data_platform TEXT,
  kb_status TEXT NOT NULL DEFAULT 'none'
    CHECK (kb_status IN ('none','building','loaded')),
  eval_pass_rate NUMERIC,
  eval_last_run_at TIMESTAMPTZ,
  salesperson_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  revenue_goal NUMERIC,
  revenue_actual NUMERIC,
  notes TEXT,
  research JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (company_id, name, state)
);

CREATE INDEX IF NOT EXISTS idx_jurisdictions_company ON public.jurisdictions(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jurisdictions TO authenticated;
GRANT ALL ON public.jurisdictions TO service_role;

ALTER TABLE public.jurisdictions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jurisdictions' AND policyname = 'Company members can view jurisdictions') THEN
    CREATE POLICY "Company members can view jurisdictions"
      ON public.jurisdictions FOR SELECT USING (public.is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jurisdictions' AND policyname = 'Company members can create jurisdictions') THEN
    CREATE POLICY "Company members can create jurisdictions"
      ON public.jurisdictions FOR INSERT WITH CHECK (public.is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jurisdictions' AND policyname = 'Company members can update jurisdictions') THEN
    CREATE POLICY "Company members can update jurisdictions"
      ON public.jurisdictions FOR UPDATE USING (public.is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jurisdictions' AND policyname = 'Company members can delete jurisdictions') THEN
    CREATE POLICY "Company members can delete jurisdictions"
      ON public.jurisdictions FOR DELETE USING (public.is_company_member(company_id));
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_jurisdictions_updated_at ON public.jurisdictions;
CREATE TRIGGER update_jurisdictions_updated_at
  BEFORE UPDATE ON public.jurisdictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.jurisdictions
  (company_id, name, state, status, tier, online_filing, license_required,
   open_data_platform, open_data_url, kb_status, notes)
SELECT
  c.id, 'New York City', 'NY', 'live', 1, true, true,
  'socrata', 'https://opendata.cityofnewyork.us',
  'loaded', 'Home market. DOB BIS/NOW + NYC Open Data integrations live.'
FROM public.companies c
ON CONFLICT (company_id, name, state) DO NOTHING;