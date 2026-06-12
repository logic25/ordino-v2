-- BD Markets — jurisdiction/expansion tracker.
-- Models the city-expansion playbook: research checklist → candidate → validating
-- (KB built + eval gate) → live, with per-market salesperson + revenue goal/actual.
-- NYC is seeded as the live home market for every tenant.

CREATE TABLE IF NOT EXISTS public.jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  name TEXT NOT NULL,                -- "Tampa"
  state TEXT,                        -- "FL"
  status TEXT NOT NULL DEFAULT 'researching'
    CHECK (status IN ('researching','candidate','validating','live','rejected')),
  tier SMALLINT CHECK (tier BETWEEN 1 AND 3),

  -- Research checklist (expansion playbook steps 1–2)
  portal_url TEXT,
  portal_platform TEXT,              -- accela / eplan / socrata-backed / custom…
  online_filing BOOLEAN,             -- full application submission online?
  plans_upload_online BOOLEAN,
  online_payments BOOLEAN,
  inspection_scheduling_online BOOLEAN,
  license_required BOOLEAN,          -- local license needed to file for others?
  owner_auth_sufficient BOOLEAN,

  -- Market volume (playbook step 3)
  annual_permits INTEGER,
  permit_trend TEXT CHECK (permit_trend IN ('increasing','flat','decreasing')),

  -- Open-data availability → powers the outbound/prospecting engine portability
  open_data_url TEXT,
  open_data_platform TEXT,           -- socrata / arcgis / accela / none / unknown

  -- Readiness gates
  kb_status TEXT NOT NULL DEFAULT 'none'
    CHECK (kb_status IN ('none','building','loaded')),
  eval_pass_rate NUMERIC,            -- latest research-eval pass % (set by eval harness)
  eval_last_run_at TIMESTAMPTZ,

  -- Go-to-market
  salesperson_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  revenue_goal NUMERIC,              -- e.g. 100000 (the Milrose-style per-market goal)
  revenue_actual NUMERIC,            -- manual for now; later derived from projects

  notes TEXT,
  research JSONB NOT NULL DEFAULT '{}'::jsonb,  -- competitor scan, dept contacts, etc.

  UNIQUE (company_id, name, state)
);

CREATE INDEX IF NOT EXISTS idx_jurisdictions_company ON public.jurisdictions(company_id);

ALTER TABLE public.jurisdictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view jurisdictions"
  ON public.jurisdictions FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "Company members can create jurisdictions"
  ON public.jurisdictions FOR INSERT WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Company members can update jurisdictions"
  ON public.jurisdictions FOR UPDATE USING (public.is_company_member(company_id));
CREATE POLICY "Company members can delete jurisdictions"
  ON public.jurisdictions FOR DELETE USING (public.is_company_member(company_id));

CREATE TRIGGER update_jurisdictions_updated_at
  BEFORE UPDATE ON public.jurisdictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed NYC as the live home market for every tenant.
INSERT INTO public.jurisdictions
  (company_id, name, state, status, tier, online_filing, license_required,
   open_data_platform, open_data_url, kb_status, notes)
SELECT
  c.id, 'New York City', 'NY', 'live', 1, true, true,
  'socrata', 'https://opendata.cityofnewyork.us',
  'loaded', 'Home market. DOB BIS/NOW + NYC Open Data integrations live.'
FROM public.companies c
ON CONFLICT (company_id, name, state) DO NOTHING;
