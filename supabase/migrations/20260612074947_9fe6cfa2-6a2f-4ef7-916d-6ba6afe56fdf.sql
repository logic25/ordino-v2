-- 1. Drop old jurisdictions table (only referenced by code being deleted)
DROP TABLE IF EXISTS public.jurisdictions CASCADE;

-- 2. Create markets table
CREATE TABLE public.markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  state text NOT NULL DEFAULT 'NY',
  tier smallint NOT NULL CHECK (tier IN (1,2,3)),
  mode text NOT NULL DEFAULT 'reactive' CHECK (mode IN ('reactive','proactive')),
  operational_score smallint CHECK (operational_score BETWEEN 0 AND 100),
  commercial_score smallint CHECK (commercial_score BETWEEN 0 AND 100),
  notes text,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  intel jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX markets_company_name_uniq ON public.markets (company_id, name);
CREATE INDEX markets_company_tier_idx ON public.markets (company_id, tier);

-- 3. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.markets TO authenticated;
GRANT ALL ON public.markets TO service_role;

-- 4. RLS
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage markets"
  ON public.markets
  FOR ALL
  TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- 5. updated_at trigger (reuse existing function, same as bd_events)
CREATE TRIGGER update_markets_updated_at
  BEFORE UPDATE ON public.markets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Seed 5 starter markets for every existing company
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    INSERT INTO public.markets (company_id, name, state, tier, mode, operational_score, commercial_score) VALUES
      (c.id, 'Manhattan',           'NY', 1, 'proactive', 90, 95),
      (c.id, 'Brooklyn',            'NY', 1, 'proactive', 90, 80),
      (c.id, 'Nassau County',       'NY', 1, 'reactive',  60, 30),
      (c.id, 'Westchester County',  'NY', 2, 'reactive',  40, 20),
      (c.id, 'Jersey City',         'NJ', 2, 'reactive',  30, 15)
    ON CONFLICT (company_id, name) DO NOTHING;
  END LOOP;
END $$;

-- 7. Changelog entry per company
INSERT INTO public.changelog_entries (company_id, date, title, description, tag)
SELECT id, CURRENT_DATE, 'Markets page',
       'Markets page rebuilt with tier/mode model and AI research',
       'feature'
FROM public.companies;