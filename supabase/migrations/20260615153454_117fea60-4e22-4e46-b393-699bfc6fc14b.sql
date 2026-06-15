-- Backfill: mirror existing PM/manager profiles into user_roles
INSERT INTO public.user_roles (user_id, role, company_id)
SELECT p.user_id, p.role::text::app_role, p.company_id
FROM public.profiles p
WHERE p.role::text IN ('manager','pm')
  AND p.is_active = true
ON CONFLICT (user_id, role, company_id) DO NOTHING;

-- Replace seed_role_permissions to cover all five roles
CREATE OR REPLACE FUNCTION public.seed_role_permissions(target_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  resources text[] := ARRAY[
    'dashboard','projects','properties','proposals','invoices',
    'time_logs','emails','calendar','documents','clients',
    'settings','users','roles','reports'
  ];
  r text;
BEGIN
  -- ADMIN: everything
  FOREACH r IN ARRAY resources LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'admin', r, true, true, true, true, true, true)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;

  -- MANAGER: one notch below admin
  FOREACH r IN ARRAY ARRAY['dashboard','projects','properties','proposals','invoices','time_logs','emails','calendar','documents','clients','reports'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'manager', r, true, true, true, true, true, true)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['settings','users','roles'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'manager', r, false, false, false, false, false, false)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;

  -- PM
  FOREACH r IN ARRAY ARRAY['dashboard','projects','properties','proposals','time_logs','calendar','documents'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'pm', r, true, true, true, true, true, true)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['invoices','clients','emails','reports'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'pm', r, true, true, true, false, false, false)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['settings','users','roles'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'pm', r, false, false, false, false, false, false)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;

  -- PRODUCTION
  FOREACH r IN ARRAY ARRAY['projects','properties','proposals','time_logs','calendar','documents','dashboard'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'production', r, true, true, true, true, true, true)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['invoices','clients','emails'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'production', r, true, true, true, false, false, false)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['users','roles','settings','reports'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'production', r, false, false, false, false, false, false)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;

  -- ACCOUNTING (now writes proposals)
  FOREACH r IN ARRAY ARRAY['invoices','time_logs','clients','dashboard','proposals'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'accounting', r, true, true, true, true, true, true)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['projects','emails'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'accounting', r, true, true, true, false, false, false)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['properties','users','roles','settings','reports','calendar','documents'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'accounting', r, false, false, false, false, false, false)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;
END;
$function$;

-- Backfill: existing accounting/proposals row -> grant write
UPDATE public.role_permissions
SET enabled = true, can_list = true, can_show = true,
    can_create = true, can_update = true, can_delete = true
WHERE role = 'accounting' AND resource = 'proposals';

-- Backfill: seed permissions for every existing company so new roles get rows
DO $$
DECLARE c_id uuid;
BEGIN
  FOR c_id IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_role_permissions(c_id);
  END LOOP;
END $$;

-- Changelog entry per company
INSERT INTO public.changelog_entries (company_id, title, description, tag)
SELECT id,
  'Role permissions audit',
  'Fixed role-permission consistency: PM and Manager roles are now properly tracked, Accounting can create and edit proposals, and the unused Staff role is no longer offered as a choice.',
  'improvement'
FROM public.companies;