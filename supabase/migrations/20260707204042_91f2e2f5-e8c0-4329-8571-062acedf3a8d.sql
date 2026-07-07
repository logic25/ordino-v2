
-- 1) Backfill portal_role for existing GLE staff profiles
UPDATE public.profiles
SET portal_role = 'gle_staff'
WHERE portal_role IS NULL
  AND (
    id IN (SELECT id FROM auth.users WHERE email ILIKE '%@greenlightexpediting.com')
    OR user_id IN (SELECT id FROM auth.users WHERE email ILIKE '%@greenlightexpediting.com')
  );

-- 2) Default new profiles to gle_staff unless explicitly set to client
ALTER TABLE public.profiles
  ALTER COLUMN portal_role SET DEFAULT 'gle_staff';

-- 3) Filing status/blocked change → portal_notifications row (email fan-out handled by edge function)
CREATE OR REPLACE FUNCTION public.portal_notify_on_filing_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_title text;
  v_msg text;
  v_project_name text;
  v_client_org uuid;
  v_membership record;
BEGIN
  -- Determine event type
  IF TG_OP = 'UPDATE' AND NEW.blocked = true AND (OLD.blocked IS DISTINCT FROM true) THEN
    v_type := 'blocked';
    v_title := 'Filing blocked';
    v_msg := COALESCE(NEW.blocked_reason, 'A filing was flagged as blocked.');
  ELSIF TG_OP = 'UPDATE' AND NEW.current_stage IS DISTINCT FROM OLD.current_stage
        AND NEW.current_stage IN ('objections','approved','permit_issued') THEN
    v_type := NEW.current_stage::text;
    v_title := CASE NEW.current_stage::text
      WHEN 'objections' THEN 'Objections received'
      WHEN 'approved' THEN 'Filing approved'
      WHEN 'permit_issued' THEN 'Permit issued'
    END;
    v_msg := NEW.discipline::text || ' filing moved to ' || NEW.current_stage::text;
  ELSE
    RETURN NEW;
  END IF;

  -- Look up project + client org
  SELECT p.name, p.client_org_id
    INTO v_project_name, v_client_org
  FROM public.projects p
  WHERE p.id = NEW.project_id;

  IF v_client_org IS NULL THEN
    RETURN NEW; -- not a portal project
  END IF;

  -- Fan out to every user in that client org
  FOR v_membership IN
    SELECT user_id FROM public.client_org_memberships WHERE client_org_id = v_client_org
  LOOP
    INSERT INTO public.portal_notifications (user_id, project_id, filing_id, type, title, message, read)
    VALUES (v_membership.user_id, NEW.project_id, NEW.id, v_type,
            v_title || COALESCE(' — ' || v_project_name, ''),
            v_msg, false);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_notify_on_filing_change ON public.filings;
CREATE TRIGGER trg_portal_notify_on_filing_change
AFTER UPDATE ON public.filings
FOR EACH ROW
EXECUTE FUNCTION public.portal_notify_on_filing_change();
