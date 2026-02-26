
-- =============================================
-- 1. CO Timeline Event Triggers
-- =============================================

CREATE OR REPLACE FUNCTION public.co_timeline_trigger()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- On INSERT: co_created
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.project_timeline_events (company_id, project_id, event_type, description, actor_id, metadata)
    VALUES (
      NEW.company_id, NEW.project_id, 'co_created',
      'Change Order ' || NEW.co_number || ' created: ' || NEW.title,
      NEW.created_by,
      jsonb_build_object('co_id', NEW.id, 'co_number', NEW.co_number, 'amount', NEW.amount)
    );
    RETURN NEW;
  END IF;

  -- On UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- co_signed_internally
    IF NEW.internal_signed_at IS NOT NULL AND OLD.internal_signed_at IS NULL THEN
      INSERT INTO public.project_timeline_events (company_id, project_id, event_type, description, actor_id, metadata)
      VALUES (
        NEW.company_id, NEW.project_id, 'co_signed_internally',
        NEW.co_number || ' signed internally',
        NEW.internal_signed_by,
        jsonb_build_object('co_id', NEW.id, 'co_number', NEW.co_number)
      );
    END IF;

    -- co_sent_to_client
    IF NEW.sent_at IS NOT NULL AND OLD.sent_at IS NULL THEN
      INSERT INTO public.project_timeline_events (company_id, project_id, event_type, description, actor_id, metadata)
      VALUES (
        NEW.company_id, NEW.project_id, 'co_sent_to_client',
        NEW.co_number || ' sent to client' || COALESCE(' (' || NEW.sent_to_email || ')', ''),
        NEW.created_by,
        jsonb_build_object('co_id', NEW.id, 'co_number', NEW.co_number, 'sent_to', NEW.sent_to_email)
      );
    END IF;

    -- co_client_signed
    IF NEW.client_signed_at IS NOT NULL AND OLD.client_signed_at IS NULL THEN
      INSERT INTO public.project_timeline_events (company_id, project_id, event_type, description, actor_id, metadata)
      VALUES (
        NEW.company_id, NEW.project_id, 'co_client_signed',
        NEW.co_number || ' signed by client' || COALESCE(' (' || NEW.client_signer_name || ')', ''),
        NULL,
        jsonb_build_object('co_id', NEW.id, 'co_number', NEW.co_number, 'signer', NEW.client_signer_name)
      );
    END IF;

    -- co_approved
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
      INSERT INTO public.project_timeline_events (company_id, project_id, event_type, description, actor_id, metadata)
      VALUES (
        NEW.company_id, NEW.project_id, 'co_approved',
        NEW.co_number || ' approved — fully executed',
        NEW.created_by,
        jsonb_build_object('co_id', NEW.id, 'co_number', NEW.co_number, 'amount', NEW.amount)
      );
    END IF;

    -- co_voided
    IF NEW.status = 'voided' AND OLD.status != 'voided' THEN
      INSERT INTO public.project_timeline_events (company_id, project_id, event_type, description, actor_id, metadata)
      VALUES (
        NEW.company_id, NEW.project_id, 'co_voided',
        NEW.co_number || ' voided',
        NEW.created_by,
        jsonb_build_object('co_id', NEW.id, 'co_number', NEW.co_number)
      );
    END IF;

    -- co_rejected
    IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
      INSERT INTO public.project_timeline_events (company_id, project_id, event_type, description, actor_id, metadata)
      VALUES (
        NEW.company_id, NEW.project_id, 'co_rejected',
        NEW.co_number || ' rejected',
        NEW.created_by,
        jsonb_build_object('co_id', NEW.id, 'co_number', NEW.co_number)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER co_timeline_on_insert
  AFTER INSERT ON public.change_orders
  FOR EACH ROW EXECUTE FUNCTION public.co_timeline_trigger();

CREATE TRIGGER co_timeline_on_update
  AFTER UPDATE ON public.change_orders
  FOR EACH ROW EXECUTE FUNCTION public.co_timeline_trigger();

-- =============================================
-- 2. Project Number Format: YYYY-NNNN
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_project_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
  year_str TEXT;
BEGIN
  year_str := to_char(now(), 'YYYY');
  
  -- Count existing projects for this company in this year (both old PJ format and new YYYY- format)
  SELECT COALESCE(MAX(
    CASE 
      WHEN project_number ~ ('^' || year_str || '-[0-9]+$')
      THEN CAST(SUBSTRING(project_number FROM LENGTH(year_str || '-') + 1) AS INTEGER)
      WHEN project_number ~ ('^PJ' || year_str || '-[0-9]+$')
      THEN CAST(SUBSTRING(project_number FROM LENGTH('PJ' || year_str || '-') + 1) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM public.projects
  WHERE (project_number LIKE year_str || '-%' OR project_number LIKE 'PJ' || year_str || '-%')
    AND company_id = NEW.company_id;
  
  NEW.project_number := year_str || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;

-- =============================================
-- 3. Phase Stepper Automation Triggers
-- =============================================

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
  -- Determine project_id based on which table triggered
  IF TG_TABLE_NAME = 'dob_applications' THEN
    proj_id := NEW.project_id;
  ELSIF TG_TABLE_NAME = 'services' THEN
    proj_id := NEW.project_id;
  ELSE
    RETURN NEW;
  END IF;

  IF proj_id IS NULL THEN RETURN NEW; END IF;

  SELECT phase INTO current_phase FROM public.projects WHERE id = proj_id;

  -- Pre-Filing -> Filing: when a DOB application is inserted
  IF current_phase = 'pre_filing' AND TG_TABLE_NAME = 'dob_applications' AND TG_OP = 'INSERT' THEN
    UPDATE public.projects SET phase = 'filing', updated_at = now() WHERE id = proj_id;
    RETURN NEW;
  END IF;

  -- Filing -> Approval: when all DOB applications are approved
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

  -- Approval -> Closeout: when all services are completed or billed
  IF current_phase = 'approval' AND TG_TABLE_NAME = 'services' THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.services
      WHERE project_id = proj_id AND (status IS NULL OR status NOT IN ('completed', 'billed'))
    ) INTO all_services_done;

    IF all_services_done THEN
      UPDATE public.projects SET phase = 'closeout', updated_at = now() WHERE id = proj_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER phase_advance_on_dob_app
  AFTER INSERT OR UPDATE ON public.dob_applications
  FOR EACH ROW EXECUTE FUNCTION public.auto_advance_project_phase();

CREATE TRIGGER phase_advance_on_service
  AFTER UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.auto_advance_project_phase();
