-- market_readiness view: one row per market summarizing what's ready for downstream
-- (proposals, PM auto-briefs, Beacon) to query without knowing the JSONB shape.
CREATE OR REPLACE VIEW public.market_readiness AS
WITH svc AS (
  SELECT
    m.id AS market_id,
    m.company_id,
    COALESCE(jsonb_array_length(m.services), 0) AS services_total,
    COALESCE((
      SELECT COUNT(*)
      FROM jsonb_array_elements(m.services) s
      WHERE (s->>'offered')::boolean IS TRUE
    ), 0) AS services_offered,
    COALESCE((
      SELECT COUNT(*)
      FROM jsonb_array_elements(m.services) s
      WHERE (s->>'offered')::boolean IS TRUE
        AND s->>'verified_at' IS NOT NULL
    ), 0) AS services_verified
  FROM public.markets m
),
pb AS (
  SELECT
    market_id,
    COUNT(*) AS playbooks_total,
    COUNT(*) FILTER (WHERE last_verified_at IS NOT NULL) AS playbooks_fully_verified
  FROM public.permit_playbooks
  GROUP BY market_id
)
SELECT
  m.id AS market_id,
  m.company_id,
  m.name,
  m.state,
  m.tier,
  m.third_party_review_allowed,
  (m.third_party_review_allowed <> 'unknown') AS third_party_review_known,
  COALESCE(svc.services_total, 0) AS services_total,
  COALESCE(svc.services_offered, 0) AS services_offered,
  COALESCE(svc.services_verified, 0) AS services_verified,
  COALESCE(pb.playbooks_total, 0) AS playbooks_total,
  COALESCE(pb.playbooks_fully_verified, 0) AS playbooks_fully_verified
FROM public.markets m
LEFT JOIN svc ON svc.market_id = m.id
LEFT JOIN pb  ON pb.market_id  = m.id;

GRANT SELECT ON public.market_readiness TO authenticated;
GRANT SELECT ON public.market_readiness TO service_role;