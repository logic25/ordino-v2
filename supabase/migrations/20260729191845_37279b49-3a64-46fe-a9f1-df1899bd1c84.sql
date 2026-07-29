
CREATE TABLE IF NOT EXISTS public.client_health_settings (
  company_id uuid PRIMARY KEY,
  dormancy_days integer NOT NULL DEFAULT 90,
  concentration_ratio numeric NOT NULL DEFAULT 0.5,
  concentration_max_active_projects integer NOT NULL DEFAULT 2,
  concentration_badge_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_health_settings TO authenticated;
GRANT ALL ON public.client_health_settings TO service_role;

ALTER TABLE public.client_health_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can read client health settings"
ON public.client_health_settings FOR SELECT TO authenticated
USING (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admins can manage client health settings"
ON public.client_health_settings FOR ALL TO authenticated
USING (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
WITH CHECK (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_client_health_settings_updated_at ON public.client_health_settings;
CREATE TRIGGER update_client_health_settings_updated_at
BEFORE UPDATE ON public.client_health_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_proposals_client_sent_at ON public.proposals (client_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_proposals_client_converted_at ON public.proposals (client_id, converted_at);

DROP VIEW IF EXISTS public.client_health;
CREATE VIEW public.client_health
WITH (security_invoker = true)
AS
WITH prop AS (
  SELECT
    pr.client_id,
    pr.company_id,
    pr.sent_at,
    pr.converted_at,
    pr.total_amount,
    pr.lead_source,
    pr.status::text AS status,
    pr.converted_project_id,
    COALESCE(pr.sales_person_id, pr.created_by) AS owner_id,
    (pr.sales_person_id IS NULL AND pr.created_by IS NOT NULL) AS owner_is_inferred
  FROM public.proposals pr
  WHERE pr.client_id IS NOT NULL
),
agg AS (
  SELECT
    p.client_id,
    p.company_id,
    MIN(p.sent_at) FILTER (WHERE p.sent_at IS NOT NULL) AS first_proposal_date,
    MAX(COALESCE(p.converted_at, p.sent_at)) FILTER (WHERE p.sent_at IS NOT NULL) AS last_activity_date,
    COUNT(*) FILTER (WHERE p.sent_at IS NOT NULL) AS proposals_sent_total,
    COUNT(*) FILTER (WHERE p.sent_at IS NULL) AS proposals_missing_sent_at,
    COALESCE(SUM(p.total_amount) FILTER (
      WHERE p.sent_at IS NOT NULL AND p.sent_at >= date_trunc('year', now())
    ), 0) AS ytd_proposed_value,
    COUNT(*) FILTER (WHERE p.sent_at IS NOT NULL AND p.sent_at >= date_trunc('year', now())) AS ytd_sent_count,
    COUNT(*) FILTER (WHERE p.sent_at IS NOT NULL AND p.converted_at IS NOT NULL AND p.sent_at >= date_trunc('year', now())) AS ytd_converted_count,
    COUNT(*) FILTER (WHERE p.converted_at IS NOT NULL) AS converted_total,
    BOOL_OR(p.owner_is_inferred) AS any_owner_inferred,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.owner_id), NULL) AS owner_ids,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.lead_source), NULL) AS lead_sources
  FROM prop p
  GROUP BY p.client_id, p.company_id
),
active AS (
  SELECT p.client_id, COUNT(DISTINCT pj.id) AS active_project_count
  FROM prop p
  JOIN public.projects pj ON pj.id = p.converted_project_id
  WHERE pj.status IN ('open', 'on_hold')
  GROUP BY p.client_id
)
SELECT
  c.id AS client_id,
  c.company_id,
  c.name AS client_name,
  c.client_type,
  c.expected_annual_value,
  a.first_proposal_date,
  a.last_activity_date,
  COALESCE(act.active_project_count, 0)::int AS active_project_count,
  COALESCE(a.proposals_sent_total, 0)::int AS proposals_sent_total,
  COALESCE(a.proposals_missing_sent_at, 0)::int AS proposals_missing_sent_at,
  COALESCE(a.converted_total, 0)::int AS converted_total,
  COALESCE(a.ytd_proposed_value, 0) AS ytd_proposed_value,
  COALESCE(a.ytd_sent_count, 0)::int AS ytd_sent_count,
  COALESCE(a.ytd_converted_count, 0)::int AS ytd_converted_count,
  CASE WHEN COALESCE(a.ytd_sent_count, 0) = 0 THEN NULL
       ELSE ROUND((a.ytd_converted_count::numeric / a.ytd_sent_count::numeric) * 100, 1)
  END AS ytd_conversion_rate,
  cpa.total_lifetime_value AS lifetime_billed_value,
  cpa.payment_reliability_score,
  cpa.avg_days_to_payment,
  COALESCE(a.owner_ids, '{}'::uuid[]) AS owner_ids,
  COALESCE(a.lead_sources, '{}'::text[]) AS lead_sources,
  COALESCE(a.any_owner_inferred, false) AS any_owner_inferred,
  (COALESCE(a.proposals_missing_sent_at, 0) > 0) AS has_incomplete_data,
  CASE
    WHEN a.last_activity_date IS NULL THEN NULL
    ELSE EXTRACT(DAY FROM (now() - a.last_activity_date))::int
  END AS days_since_last_activity,
  (
    a.last_activity_date IS NOT NULL
    AND a.last_activity_date < now() - (COALESCE(s.dormancy_days, 90) || ' days')::interval
  ) AS is_dormant,
  (
    c.expected_annual_value IS NOT NULL
    AND c.expected_annual_value > 0
    AND COALESCE(act.active_project_count, 0) <= COALESCE(s.concentration_max_active_projects, 2)
    AND COALESCE(a.ytd_proposed_value, 0) < (COALESCE(s.concentration_ratio, 0.5) * c.expected_annual_value)
  ) AS is_concentrated,
  COALESCE(s.concentration_badge_enabled, false) AS concentration_badge_enabled
FROM public.clients c
LEFT JOIN agg a ON a.client_id = c.id
LEFT JOIN active act ON act.client_id = c.id
LEFT JOIN public.client_payment_analytics cpa ON cpa.client_id = c.id
LEFT JOIN public.client_health_settings s ON s.company_id = c.company_id;

GRANT SELECT ON public.client_health TO authenticated;
