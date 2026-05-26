-- 1. Expand sync trigger to mirror admin/production/accounting from profiles to user_roles
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role::text IN ('admin', 'production', 'accounting') THEN
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (NEW.user_id, NEW.role::text::app_role, NEW.company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  -- If role changed away from one of those, clean up stale rows for this user/company
  IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.user_id
      AND company_id = NEW.company_id
      AND role::text <> NEW.role::text
      AND role::text IN ('admin', 'production', 'accounting');
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Backfill existing profiles into user_roles
INSERT INTO public.user_roles (user_id, role, company_id)
SELECT p.user_id, p.role::text::app_role, p.company_id
FROM public.profiles p
WHERE p.is_active = true
  AND p.role::text IN ('admin', 'production', 'accounting')
ON CONFLICT (user_id, role, company_id) DO NOTHING;

-- 3. Seed role_permissions for pm / manager / staff so the sidebar isn't empty
DO $$
DECLARE
  company_row RECORD;
  role_name text;
  r text;
  full_access text[] := ARRAY['projects','properties','proposals','time_logs','calendar','documents','dashboard'];
  read_only text[] := ARRAY['invoices','clients','emails','reports'];
  no_access text[] := ARRAY['users','roles','settings','rfps'];
BEGIN
  FOR company_row IN SELECT id FROM public.companies LOOP
    FOREACH role_name IN ARRAY ARRAY['pm','manager','staff'] LOOP
      FOREACH r IN ARRAY full_access LOOP
        INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
        VALUES (company_row.id, role_name, r, true, true, true, true, true, false)
        ON CONFLICT (company_id, role, resource) DO NOTHING;
      END LOOP;
      FOREACH r IN ARRAY read_only LOOP
        INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
        VALUES (company_row.id, role_name, r, true, true, true, false, false, false)
        ON CONFLICT (company_id, role, resource) DO NOTHING;
      END LOOP;
      FOREACH r IN ARRAY no_access LOOP
        INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
        VALUES (company_row.id, role_name, r, false, false, false, false, false, false)
        ON CONFLICT (company_id, role, resource) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;