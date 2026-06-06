-- 1) Add PLANNING to bd_lead_timeline enum
ALTER TYPE public.bd_lead_timeline ADD VALUE IF NOT EXISTS 'PLANNING';

-- 2) Create lead_views table
CREATE TABLE IF NOT EXISTS public.lead_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  name text NOT NULL,
  filters_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  columns_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_json jsonb NOT NULL DEFAULT '{"id":"created_at","desc":true}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_views TO authenticated;
GRANT ALL ON public.lead_views TO service_role;

ALTER TABLE public.lead_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own lead views"
  ON public.lead_views FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND company_id = public.get_user_company_id());

CREATE POLICY "Company admins can view team lead views"
  ON public.lead_views FOR SELECT
  TO authenticated
  USING (public.is_company_admin(company_id));

CREATE TRIGGER update_lead_views_updated_at
  BEFORE UPDATE ON public.lead_views
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS lead_views_user_idx ON public.lead_views(user_id);
CREATE INDEX IF NOT EXISTS lead_views_company_idx ON public.lead_views(company_id);
