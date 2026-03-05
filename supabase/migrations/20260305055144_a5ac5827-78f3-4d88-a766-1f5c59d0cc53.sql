
-- 1. Update any services currently set to 'complete' → 'billed'
UPDATE public.services SET status = 'billed' WHERE status = 'complete';

-- 2. Recreate enum without 'complete'
ALTER TYPE public.service_status RENAME TO service_status_old;
CREATE TYPE public.service_status AS ENUM ('not_started', 'in_progress', 'billed', 'paid', 'dropped');
ALTER TABLE public.services ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.services ALTER COLUMN status TYPE public.service_status USING status::text::public.service_status;
ALTER TABLE public.services ALTER COLUMN status SET DEFAULT 'not_started'::public.service_status;
DROP TYPE public.service_status_old;

-- 3. Update auto_advance_project_phase() to check for billed/paid instead of completed/billed
CREATE OR REPLACE FUNCTION public.auto_advance_project_phase()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  proj_id uuid;
  current_phase text;
  all_apps_approved boolean;
  all_services_done boolean;
BEGIN
  IF TG_TABLE_NAME = 'dob_applications' THEN
    proj_id := NEW.project_id;
  ELSIF TG_TABLE_NAME = 'services' THEN
    proj_id := NEW.project_id;
  ELSE
    RETURN NEW;
  END IF;

  IF proj_id IS NULL THEN RETURN NEW; END IF;

  SELECT phase INTO current_phase FROM public.projects WHERE id = proj_id;

  IF current_phase = 'pre_filing' AND TG_TABLE_NAME = 'dob_applications' AND TG_OP = 'INSERT' THEN
    UPDATE public.projects SET phase = 'filing', updated_at = now() WHERE id = proj_id;
    RETURN NEW;
  END IF;

  IF current_phase = 'filing' AND TG_TABLE_NAME = 'dob_applications' THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.dob_applications
      WHERE project_id = proj_id AND (status IS NULL OR status != 'approved')
    ) INTO all_apps_approved;

    IF all_apps_approved THEN
      UPDATE public.projects SET phase = 'approval', updated_at = now() WHERE id = proj_id;
    END IF;
    RETURN NEW;
  END IF;

  IF current_phase = 'approval' AND TG_TABLE_NAME = 'services' THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.services
      WHERE project_id = proj_id AND (status IS NULL OR status NOT IN ('billed', 'paid'))
    ) INTO all_services_done;

    IF all_services_done THEN
      UPDATE public.projects SET phase = 'closeout', updated_at = now() WHERE id = proj_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;
