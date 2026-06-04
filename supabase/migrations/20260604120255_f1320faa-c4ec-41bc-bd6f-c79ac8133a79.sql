
-- Event-driven project summary regen via pg_net -> auto-summarize-projects
-- Debounce logic lives inside the edge function.

CREATE OR REPLACE FUNCTION public.enqueue_project_summary(_project_id uuid, _company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  func_url text := 'https://mimlfjkisguktiqqkpkm.supabase.co/functions/v1/auto-summarize-projects';
  cron_secret text;
BEGIN
  IF _project_id IS NULL OR _company_id IS NULL THEN RETURN; END IF;

  SELECT decrypted_secret INTO cron_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;

  IF cron_secret IS NULL THEN RETURN; END IF;

  PERFORM net.http_post(
    url := func_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object('projectId', _project_id, 'companyId', _company_id)
  );
EXCEPTION WHEN OTHERS THEN
  -- never block the originating transaction
  RAISE WARNING 'enqueue_project_summary failed: %', SQLERRM;
END;
$$;

-- Project notes (manual notes)
CREATE OR REPLACE FUNCTION public.trg_project_notes_summary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.source = 'manual' OR NEW.source IS NULL THEN
    PERFORM public.enqueue_project_summary(NEW.project_id, NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS project_notes_summary_trigger ON public.project_notes;
CREATE TRIGGER project_notes_summary_trigger
  AFTER INSERT ON public.project_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_project_notes_summary();

-- Project status / waiting_on changes
CREATE OR REPLACE FUNCTION public.trg_projects_summary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.waiting_on IS DISTINCT FROM OLD.waiting_on
     OR NEW.phase IS DISTINCT FROM OLD.phase THEN
    PERFORM public.enqueue_project_summary(NEW.id, NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS projects_summary_trigger ON public.projects;
CREATE TRIGGER projects_summary_trigger
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_projects_summary();

-- Service status changes
CREATE OR REPLACE FUNCTION public.trg_services_summary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  PERFORM public.enqueue_project_summary(NEW.project_id, NEW.company_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS services_summary_trigger ON public.services;
CREATE TRIGGER services_summary_trigger
  AFTER INSERT OR UPDATE OF status ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trg_services_summary();

-- Change orders status changes
CREATE OR REPLACE FUNCTION public.trg_change_orders_summary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  PERFORM public.enqueue_project_summary(NEW.project_id, NEW.company_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS change_orders_summary_trigger ON public.change_orders;
CREATE TRIGGER change_orders_summary_trigger
  AFTER INSERT OR UPDATE OF status ON public.change_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_change_orders_summary();

-- Checklist item status changes (e.g., item marked done, new item added)
CREATE OR REPLACE FUNCTION public.trg_checklist_summary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  PERFORM public.enqueue_project_summary(NEW.project_id, NEW.company_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS checklist_summary_trigger ON public.project_checklist_items;
CREATE TRIGGER checklist_summary_trigger
  AFTER INSERT OR UPDATE OF status ON public.project_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_checklist_summary();

-- New project-tagged email arrives
CREATE OR REPLACE FUNCTION public.trg_email_tag_summary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enqueue_project_summary(NEW.project_id, NEW.company_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS email_tag_summary_trigger ON public.email_project_tags;
CREATE TRIGGER email_tag_summary_trigger
  AFTER INSERT ON public.email_project_tags
  FOR EACH ROW EXECUTE FUNCTION public.trg_email_tag_summary();
