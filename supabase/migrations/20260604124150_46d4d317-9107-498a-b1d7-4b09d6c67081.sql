
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS stale_threshold_days integer;

UPDATE public.projects p SET last_activity_at = sub.latest
FROM (
  SELECT p2.id,
    GREATEST(
      COALESCE(p2.updated_at, p2.created_at),
      COALESCE(pn.mx, 'epoch'::timestamptz),
      COALESCE(et.mx, 'epoch'::timestamptz),
      COALESCE(ci.mx, 'epoch'::timestamptz),
      COALESCE(sv.mx, 'epoch'::timestamptz),
      COALESCE(co.mx, 'epoch'::timestamptz)
    ) AS latest
  FROM public.projects p2
  LEFT JOIN (SELECT project_id, MAX(created_at) mx FROM public.project_notes GROUP BY project_id) pn ON pn.project_id = p2.id
  LEFT JOIN (SELECT project_id, MAX(tagged_at) mx FROM public.email_project_tags GROUP BY project_id) et ON et.project_id = p2.id
  LEFT JOIN (SELECT project_id, MAX(updated_at) mx FROM public.project_checklist_items GROUP BY project_id) ci ON ci.project_id = p2.id
  LEFT JOIN (SELECT project_id, MAX(updated_at) mx FROM public.services GROUP BY project_id) sv ON sv.project_id = p2.id
  LEFT JOIN (SELECT project_id, MAX(updated_at) mx FROM public.change_orders GROUP BY project_id) co ON co.project_id = p2.id
) sub
WHERE p.id = sub.id AND p.last_activity_at IS NULL;

CREATE OR REPLACE FUNCTION public.touch_project_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
  IF TG_TABLE_NAME = 'projects' THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.last_activity_at := now();
    END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'activities' THEN
    SELECT project_id INTO pid FROM public.services WHERE id = COALESCE(NEW.service_id, OLD.service_id);
  ELSE
    pid := COALESCE(NEW.project_id, OLD.project_id);
  END IF;
  IF pid IS NOT NULL THEN
    UPDATE public.projects SET last_activity_at = now() WHERE id = pid;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_touch_activity ON public.projects;
CREATE TRIGGER trg_projects_touch_activity BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.touch_project_activity();
DROP TRIGGER IF EXISTS trg_project_notes_activity ON public.project_notes;
CREATE TRIGGER trg_project_notes_activity AFTER INSERT OR UPDATE ON public.project_notes FOR EACH ROW EXECUTE FUNCTION public.touch_project_activity();
DROP TRIGGER IF EXISTS trg_email_tags_activity ON public.email_project_tags;
CREATE TRIGGER trg_email_tags_activity AFTER INSERT ON public.email_project_tags FOR EACH ROW EXECUTE FUNCTION public.touch_project_activity();
DROP TRIGGER IF EXISTS trg_checklist_activity ON public.project_checklist_items;
CREATE TRIGGER trg_checklist_activity AFTER INSERT OR UPDATE ON public.project_checklist_items FOR EACH ROW EXECUTE FUNCTION public.touch_project_activity();
DROP TRIGGER IF EXISTS trg_activities_activity ON public.activities;
CREATE TRIGGER trg_activities_activity AFTER INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION public.touch_project_activity();
DROP TRIGGER IF EXISTS trg_services_activity ON public.services;
CREATE TRIGGER trg_services_activity AFTER INSERT OR UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.touch_project_activity();
DROP TRIGGER IF EXISTS trg_change_orders_activity ON public.change_orders;
CREATE TRIGGER trg_change_orders_activity AFTER INSERT OR UPDATE ON public.change_orders FOR EACH ROW EXECUTE FUNCTION public.touch_project_activity();

CREATE TABLE IF NOT EXISTS public.ai_budget_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  monthly_cap_usd numeric(10,2),
  alert_threshold_pct integer NOT NULL DEFAULT 80,
  alert_emails text[] NOT NULL DEFAULT '{}',
  last_alert_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_budget_settings TO authenticated;
GRANT ALL ON public.ai_budget_settings TO service_role;
ALTER TABLE public.ai_budget_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ai budget settings" ON public.ai_budget_settings FOR ALL TO authenticated
  USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY "Members view ai budget settings" ON public.ai_budget_settings FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
DROP TRIGGER IF EXISTS trg_ai_budget_settings_updated_at ON public.ai_budget_settings;
CREATE TRIGGER trg_ai_budget_settings_updated_at BEFORE UPDATE ON public.ai_budget_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
