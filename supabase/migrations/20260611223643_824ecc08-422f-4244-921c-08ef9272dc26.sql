
-- 1. Service & proposal columns
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_pro_cert boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bill_date_reasoning text,
  ADD COLUMN IF NOT EXISTS estimated_bill_date_computed_at timestamptz,
  ADD COLUMN IF NOT EXISTS filed_at timestamptz,
  ADD COLUMN IF NOT EXISTS objections_received_at timestamptz;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS is_pro_cert boolean NOT NULL DEFAULT false;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_tier text CHECK (client_tier IN ('fast','normal','slow'));

-- Drop legacy check, re-add with 'ai' allowed (it already allows 'ai' but we re-assert)
-- (skipped: services_bill_date_source_check already includes 'ai')

-- 2. service_duration_baselines
CREATE TABLE IF NOT EXISTS public.service_duration_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  complexity text,
  building_class text,
  client_tier text,
  is_pro_cert boolean NOT NULL DEFAULT false,
  median_active_days numeric(8,2),
  median_total_days numeric(8,2),
  median_hours numeric(8,2),
  p20_days numeric(8,2),
  p80_days numeric(8,2),
  std_dev_days numeric(8,2),
  sample_size integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, service_type, complexity, building_class, client_tier, is_pro_cert)
);
GRANT SELECT ON public.service_duration_baselines TO authenticated;
GRANT ALL ON public.service_duration_baselines TO service_role;
ALTER TABLE public.service_duration_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members read baselines" ON public.service_duration_baselines
  FOR SELECT TO authenticated USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE INDEX IF NOT EXISTS idx_baselines_lookup ON public.service_duration_baselines
  (company_id, service_type, is_pro_cert);

-- 3. prediction_outcomes
CREATE TABLE IF NOT EXISTS public.prediction_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  predicted_date date NOT NULL,
  predicted_at timestamptz NOT NULL DEFAULT now(),
  actual_billed_date date,
  error_days integer,
  prediction_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_version text NOT NULL DEFAULT 'v2-baseline'
);
GRANT SELECT, INSERT, UPDATE ON public.prediction_outcomes TO authenticated;
GRANT ALL ON public.prediction_outcomes TO service_role;
ALTER TABLE public.prediction_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members read outcomes" ON public.prediction_outcomes
  FOR SELECT TO authenticated USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE INDEX IF NOT EXISTS idx_outcomes_service ON public.prediction_outcomes(service_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_company_billed ON public.prediction_outcomes(company_id, actual_billed_date);

-- 4. service_prediction_cache
CREATE TABLE IF NOT EXISTS public.service_prediction_cache (
  service_id uuid PRIMARY KEY REFERENCES public.services(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  notes_hash text NOT NULL,
  ai_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_prediction_cache TO authenticated;
GRANT ALL ON public.service_prediction_cache TO service_role;
ALTER TABLE public.service_prediction_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members read prediction cache" ON public.service_prediction_cache
  FOR SELECT TO authenticated USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- 5. prediction_accuracy_history
CREATE TABLE IF NOT EXISTS public.prediction_accuracy_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_type text,
  snapshot_date date NOT NULL DEFAULT current_date,
  sample_size integer NOT NULL DEFAULT 0,
  pct_within_7d numeric(5,2),
  pct_within_14d numeric(5,2),
  pct_within_30d numeric(5,2),
  median_abs_error_days numeric(8,2),
  UNIQUE (company_id, service_type, snapshot_date)
);
GRANT SELECT ON public.prediction_accuracy_history TO authenticated;
GRANT ALL ON public.prediction_accuracy_history TO service_role;
ALTER TABLE public.prediction_accuracy_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members read accuracy" ON public.prediction_accuracy_history
  FOR SELECT TO authenticated USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- 6. prediction_feedback
CREATE TABLE IF NOT EXISTS public.prediction_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  predicted_date date,
  user_estimated_date date,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.prediction_feedback TO authenticated;
GRANT ALL ON public.prediction_feedback TO service_role;
ALTER TABLE public.prediction_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members insert feedback" ON public.prediction_feedback
  FOR INSERT TO authenticated WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Company members read feedback" ON public.prediction_feedback
  FOR SELECT TO authenticated USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- 7. Trigger: when a service flips to 'billed', close the latest open prediction_outcome
CREATE OR REPLACE FUNCTION public.log_service_billed_outcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'billed' AND (OLD.status IS DISTINCT FROM 'billed') AND NEW.billed_at IS NOT NULL THEN
    UPDATE public.prediction_outcomes
       SET actual_billed_date = NEW.billed_at::date,
           error_days = (NEW.billed_at::date - predicted_date)
     WHERE service_id = NEW.id
       AND actual_billed_date IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_service_billed_outcome ON public.services;
CREATE TRIGGER trg_log_service_billed_outcome
  AFTER UPDATE OF status, billed_at ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.log_service_billed_outcome();
