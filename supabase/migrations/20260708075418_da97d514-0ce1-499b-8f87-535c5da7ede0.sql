
-- Enums
DO $$ BEGIN
  CREATE TYPE public.competitor_scope AS ENUM ('solo','local','regional','national');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.competitor_pricing_model AS ENUM ('flat','hourly','percent','mixed','unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE public.market_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  name text NOT NULL,
  url text,
  scope public.competitor_scope NOT NULL DEFAULT 'local',
  pricing_text text,
  pricing_model public.competitor_pricing_model NOT NULL DEFAULT 'unknown',
  source_url text,
  signal_notes text,
  research_model text,
  research_run_id uuid,
  verified_at timestamptz,
  verified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX market_competitors_market_id_idx ON public.market_competitors(market_id);
CREATE INDEX market_competitors_company_id_idx ON public.market_competitors(company_id);
CREATE INDEX market_competitors_verified_idx ON public.market_competitors(market_id) WHERE verified_at IS NOT NULL;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_competitors TO authenticated;
GRANT ALL ON public.market_competitors TO service_role;

-- RLS (mirror markets: is_company_member(company_id))
ALTER TABLE public.market_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage market competitors"
  ON public.market_competitors
  FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- updated_at trigger
CREATE TRIGGER market_competitors_updated_at
  BEFORE UPDATE ON public.market_competitors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-clear verification on authoritative edits
CREATE OR REPLACE FUNCTION public.market_competitors_clear_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.verified_at IS NOT NULL
     AND NEW.verified_at IS NOT DISTINCT FROM OLD.verified_at
     AND (
       NEW.name IS DISTINCT FROM OLD.name OR
       NEW.url IS DISTINCT FROM OLD.url OR
       NEW.scope IS DISTINCT FROM OLD.scope OR
       NEW.pricing_text IS DISTINCT FROM OLD.pricing_text OR
       NEW.pricing_model IS DISTINCT FROM OLD.pricing_model OR
       NEW.source_url IS DISTINCT FROM OLD.source_url
     )
  THEN
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER market_competitors_clear_verification_trg
  BEFORE UPDATE ON public.market_competitors
  FOR EACH ROW EXECUTE FUNCTION public.market_competitors_clear_verification();

-- Extend market_readiness view with competitor counts
CREATE OR REPLACE VIEW public.market_readiness AS
WITH svc AS (
  SELECT m_1.id AS market_id,
    m_1.company_id,
    COALESCE(jsonb_array_length(m_1.services), 0) AS services_total,
    COALESCE((SELECT count(*) FROM jsonb_array_elements(m_1.services) s(value)
              WHERE ((s.value ->> 'offered')::boolean) IS TRUE), 0::bigint) AS services_offered,
    COALESCE((SELECT count(*) FROM jsonb_array_elements(m_1.services) s(value)
              WHERE ((s.value ->> 'offered')::boolean) IS TRUE
                AND (s.value ->> 'verified_at') IS NOT NULL), 0::bigint) AS services_verified
  FROM markets m_1
), pb AS (
  SELECT market_id,
    count(*) AS playbooks_total,
    count(*) FILTER (WHERE last_verified_at IS NOT NULL) AS playbooks_fully_verified
  FROM permit_playbooks GROUP BY market_id
), cmp AS (
  SELECT market_id,
    count(*) AS competitors_total,
    count(*) FILTER (WHERE verified_at IS NOT NULL) AS competitors_verified
  FROM market_competitors GROUP BY market_id
)
SELECT m.id AS market_id,
  m.company_id,
  m.name,
  m.state,
  m.tier,
  m.third_party_review_allowed,
  m.third_party_review_allowed <> 'unknown' AS third_party_review_known,
  COALESCE(svc.services_total, 0) AS services_total,
  COALESCE(svc.services_offered, 0::bigint) AS services_offered,
  COALESCE(svc.services_verified, 0::bigint) AS services_verified,
  COALESCE(pb.playbooks_total, 0::bigint) AS playbooks_total,
  COALESCE(pb.playbooks_fully_verified, 0::bigint) AS playbooks_fully_verified,
  COALESCE(cmp.competitors_total, 0::bigint) AS competitors_total,
  COALESCE(cmp.competitors_verified, 0::bigint) AS competitors_verified
FROM markets m
LEFT JOIN svc ON svc.market_id = m.id
LEFT JOIN pb ON pb.market_id = m.id
LEFT JOIN cmp ON cmp.market_id = m.id;

-- Verification
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='market_competitors'
ORDER BY cmd, policyname;
