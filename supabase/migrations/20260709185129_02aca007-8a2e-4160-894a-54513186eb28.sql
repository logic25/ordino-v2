
-- 1. Services: filing_type + stage timestamps
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS filing_type text NOT NULL DEFAULT 'new_job',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS permit_issued_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_filing_type_check') THEN
    ALTER TABLE public.services ADD CONSTRAINT services_filing_type_check CHECK (filing_type IN ('new_job','paa'));
  END IF;
END $$;

-- 2. Project notes: client_visible flag (service_id already exists)
ALTER TABLE public.project_notes
  ADD COLUMN IF NOT EXISTS client_visible boolean NOT NULL DEFAULT false;

-- 3. Action items: owner_facing flag
ALTER TABLE public.project_action_items
  ADD COLUMN IF NOT EXISTS owner_facing boolean NOT NULL DEFAULT false;

-- 4. Trigger: when DOB app dates change, mirror onto linked services + log events + notify
CREATE OR REPLACE FUNCTION public.sync_dob_dates_to_services()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  svc RECORD;
  portal_user RECORD;
BEGIN
  -- Only run on real date transitions
  IF (TG_OP = 'UPDATE') AND (
      COALESCE(NEW.filed_date::text,'') = COALESCE(OLD.filed_date::text,'') AND
      COALESCE(NEW.approved_date::text,'') = COALESCE(OLD.approved_date::text,'') AND
      COALESCE(NEW.permit_issued_date::text,'') = COALESCE(OLD.permit_issued_date::text,'')
    ) THEN
    RETURN NEW;
  END IF;

  FOR svc IN
    SELECT s.id, s.project_id, s.company_id, s.name, s.filed_at, s.approved_at, s.permit_issued_at
    FROM public.services s
    WHERE s.application_id = NEW.id
  LOOP
    -- Filed
    IF NEW.filed_date IS NOT NULL AND svc.filed_at IS NULL THEN
      UPDATE public.services SET filed_at = NEW.filed_date::timestamptz WHERE id = svc.id;
      INSERT INTO public.project_timeline_events (company_id, project_id, event_type, description, metadata)
      VALUES (svc.company_id, svc.project_id, 'service_filed',
              svc.name || ' filed under Job #' || COALESCE(NEW.job_number,'?'),
              jsonb_build_object('service_id', svc.id, 'application_id', NEW.id, 'job_number', NEW.job_number));

      FOR portal_user IN
        SELECT DISTINCT p.id AS user_id
        FROM public.projects proj
        JOIN public.client_orgs co ON co.client_id = proj.client_id
        JOIN public.client_org_memberships com ON com.client_org_id = co.id
        JOIN public.profiles p ON p.id = com.user_id
        WHERE proj.id = svc.project_id
      LOOP
        INSERT INTO public.portal_notifications (user_id, project_id, type, title, message)
        VALUES (portal_user.user_id, svc.project_id, 'service_filed',
                'Filed under Job #' || COALESCE(NEW.job_number,'?'),
                svc.name);
      END LOOP;
    END IF;

    -- Approved
    IF NEW.approved_date IS NOT NULL AND svc.approved_at IS NULL THEN
      UPDATE public.services SET approved_at = NEW.approved_date::timestamptz WHERE id = svc.id;
      INSERT INTO public.project_timeline_events (company_id, project_id, event_type, description, metadata)
      VALUES (svc.company_id, svc.project_id, 'service_approved',
              svc.name || ' approved',
              jsonb_build_object('service_id', svc.id, 'application_id', NEW.id, 'job_number', NEW.job_number));

      FOR portal_user IN
        SELECT DISTINCT p.id AS user_id
        FROM public.projects proj
        JOIN public.client_orgs co ON co.client_id = proj.client_id
        JOIN public.client_org_memberships com ON com.client_org_id = co.id
        JOIN public.profiles p ON p.id = com.user_id
        WHERE proj.id = svc.project_id
      LOOP
        INSERT INTO public.portal_notifications (user_id, project_id, type, title, message)
        VALUES (portal_user.user_id, svc.project_id, 'service_approved',
                svc.name || ' approved', 'Job #' || COALESCE(NEW.job_number,'?'));
      END LOOP;
    END IF;

    -- Permit Issued
    IF NEW.permit_issued_date IS NOT NULL AND svc.permit_issued_at IS NULL THEN
      UPDATE public.services SET permit_issued_at = NEW.permit_issued_date::timestamptz WHERE id = svc.id;
      INSERT INTO public.project_timeline_events (company_id, project_id, event_type, description, metadata)
      VALUES (svc.company_id, svc.project_id, 'permit_issued',
              'Permit issued for ' || svc.name,
              jsonb_build_object('service_id', svc.id, 'application_id', NEW.id, 'job_number', NEW.job_number));

      FOR portal_user IN
        SELECT DISTINCT p.id AS user_id
        FROM public.projects proj
        JOIN public.client_orgs co ON co.client_id = proj.client_id
        JOIN public.client_org_memberships com ON com.client_org_id = co.id
        JOIN public.profiles p ON p.id = com.user_id
        WHERE proj.id = svc.project_id
      LOOP
        INSERT INTO public.portal_notifications (user_id, project_id, type, title, message)
        VALUES (portal_user.user_id, svc.project_id, 'permit_issued',
                'Permit issued', svc.name || ' — Job #' || COALESCE(NEW.job_number,'?'));
      END LOOP;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dob_apps_sync_service_dates ON public.dob_applications;
CREATE TRIGGER trg_dob_apps_sync_service_dates
AFTER INSERT OR UPDATE OF filed_date, approved_date, permit_issued_date
ON public.dob_applications
FOR EACH ROW EXECUTE FUNCTION public.sync_dob_dates_to_services();

-- 5. Trigger: portal document upload → timeline event
CREATE OR REPLACE FUNCTION public.log_portal_document_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proj RECORD;
BEGIN
  IF NEW.project_id IS NULL THEN RETURN NEW; END IF;
  SELECT id, company_id INTO proj FROM public.projects WHERE id = NEW.project_id;
  IF proj.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.project_timeline_events (company_id, project_id, event_type, description, metadata)
  VALUES (proj.company_id, proj.id, 'document_uploaded',
          COALESCE(NEW.file_name, 'Document') || ' uploaded to portal',
          jsonb_build_object('portal_document_id', NEW.id));
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='portal_documents' AND table_schema='public') THEN
    DROP TRIGGER IF EXISTS trg_portal_documents_timeline ON public.portal_documents;
    CREATE TRIGGER trg_portal_documents_timeline
    AFTER INSERT ON public.portal_documents
    FOR EACH ROW EXECUTE FUNCTION public.log_portal_document_event();
  END IF;
END $$;

-- 6. Trigger: owner-facing action items → timeline event on insert + completion
CREATE OR REPLACE FUNCTION public.log_owner_facing_action_item_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') AND NEW.owner_facing = true THEN
    INSERT INTO public.project_timeline_events (company_id, project_id, event_type, description, actor_id, metadata)
    VALUES (NEW.company_id, NEW.project_id, 'action_item_created',
            'Requested from client: ' || NEW.title,
            NEW.assigned_by,
            jsonb_build_object('action_item_id', NEW.id, 'owner_facing', true));
  ELSIF (TG_OP = 'UPDATE') AND NEW.owner_facing = true AND OLD.status <> 'done' AND NEW.status = 'done' THEN
    INSERT INTO public.project_timeline_events (company_id, project_id, event_type, description, metadata)
    VALUES (NEW.company_id, NEW.project_id, 'client_submitted_item',
            'Client submitted: ' || NEW.title,
            jsonb_build_object('action_item_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_action_items_owner_facing_events ON public.project_action_items;
CREATE TRIGGER trg_action_items_owner_facing_events
AFTER INSERT OR UPDATE ON public.project_action_items
FOR EACH ROW EXECUTE FUNCTION public.log_owner_facing_action_item_event();

-- 7. Fix security warning: switch existing views to security_invoker
ALTER VIEW public.market_readiness SET (security_invoker = true);
ALTER VIEW public.invoice_balances_with_interest SET (security_invoker = true);
