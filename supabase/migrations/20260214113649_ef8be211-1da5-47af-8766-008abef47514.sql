
-- Part 1: Add new columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_goal numeric,
  ADD COLUMN IF NOT EXISTS about text,
  ADD COLUMN IF NOT EXISTS carrier varchar,
  ADD COLUMN IF NOT EXISTS job_title varchar;

-- Part 2: Create employee_reviews table
CREATE TABLE public.employee_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  employee_id uuid NOT NULL REFERENCES public.profiles(id),
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id),
  review_period date NOT NULL,
  overall_rating numeric,
  previous_rating numeric,
  category_ratings jsonb DEFAULT '{}',
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, review_period)
);

ALTER TABLE public.employee_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view employee reviews"
  ON public.employee_reviews FOR SELECT TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Admins can manage employee reviews"
  ON public.employee_reviews FOR ALL TO authenticated
  USING (is_company_admin(company_id))
  WITH CHECK (is_company_admin(company_id));

-- Part 3: Create role_permissions table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  role app_role NOT NULL,
  resource varchar NOT NULL,
  enabled boolean DEFAULT false,
  can_list boolean DEFAULT false,
  can_show boolean DEFAULT false,
  can_create boolean DEFAULT false,
  can_update boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  UNIQUE(company_id, role, resource)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view role permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Admins can manage role permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (is_company_admin(company_id))
  WITH CHECK (is_company_admin(company_id));

-- Part 4: Seed function for default role permissions
CREATE OR REPLACE FUNCTION public.seed_role_permissions(target_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resources text[] := ARRAY[
    'dashboard', 'projects', 'properties', 'proposals', 'invoices',
    'time_logs', 'emails', 'calendar', 'documents', 'clients',
    'settings', 'users', 'roles', 'reports'
  ];
  r text;
BEGIN
  -- Admin: everything enabled
  FOREACH r IN ARRAY resources LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'admin', r, true, true, true, true, true, true)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;

  -- Production: full access to core production resources
  FOREACH r IN ARRAY ARRAY['projects', 'properties', 'proposals', 'time_logs', 'calendar', 'documents', 'dashboard'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'production', r, true, true, true, true, true, true)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;
  -- Production: read-only for invoices, clients, emails
  FOREACH r IN ARRAY ARRAY['invoices', 'clients', 'emails'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'production', r, true, true, true, false, false, false)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;
  -- Production: no access
  FOREACH r IN ARRAY ARRAY['users', 'roles', 'settings', 'reports'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'production', r, false, false, false, false, false, false)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;

  -- Accounting: full access to billing resources
  FOREACH r IN ARRAY ARRAY['invoices', 'time_logs', 'clients', 'dashboard'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'accounting', r, true, true, true, true, true, true)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;
  -- Accounting: read-only for projects, proposals, emails
  FOREACH r IN ARRAY ARRAY['projects', 'proposals', 'emails'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'accounting', r, true, true, true, false, false, false)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;
  -- Accounting: no access
  FOREACH r IN ARRAY ARRAY['properties', 'users', 'roles', 'settings', 'reports', 'calendar', 'documents'] LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, 'accounting', r, false, false, false, false, false, false)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;
END;
$$;

-- Seed defaults for all existing companies
DO $$
DECLARE
  comp RECORD;
BEGIN
  FOR comp IN SELECT id FROM companies LOOP
    PERFORM seed_role_permissions(comp.id);
  END LOOP;
END;
$$;
