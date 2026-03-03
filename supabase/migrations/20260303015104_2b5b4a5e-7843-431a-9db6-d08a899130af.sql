
-- Store company-level report scheduling preferences
CREATE TABLE public.report_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  report_type text NOT NULL DEFAULT 'open_services',
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly')),
  day_of_week text DEFAULT 'monday' CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, report_type)
);

ALTER TABLE public.report_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view report settings"
  ON public.report_settings FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Admins can manage report settings"
  ON public.report_settings FOR ALL
  USING (public.is_admin_or_manager(company_id))
  WITH CHECK (public.is_admin_or_manager(company_id));

CREATE TRIGGER update_report_settings_updated_at
  BEFORE UPDATE ON public.report_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
