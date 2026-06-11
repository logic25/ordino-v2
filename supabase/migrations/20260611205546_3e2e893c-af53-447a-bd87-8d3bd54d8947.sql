
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_reimbursable boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.user_monthly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  goal_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_monthly_goals TO authenticated;
GRANT ALL ON public.user_monthly_goals TO service_role;

ALTER TABLE public.user_monthly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view user_monthly_goals"
  ON public.user_monthly_goals FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage user_monthly_goals"
  ON public.user_monthly_goals FOR ALL TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER update_user_monthly_goals_updated_at
  BEFORE UPDATE ON public.user_monthly_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_monthly_goals_lookup
  ON public.user_monthly_goals (company_id, year, user_id);
