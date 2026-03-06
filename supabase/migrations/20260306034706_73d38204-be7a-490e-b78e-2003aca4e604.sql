
-- 1. Create custom_roles table
CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text DEFAULT 'blue',
  icon text DEFAULT 'Shield',
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, name)
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view roles"
  ON public.custom_roles FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Admins can manage roles"
  ON public.custom_roles FOR ALL TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- 2. Change user_roles.role from enum to text
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_company_unique UNIQUE (user_id, role, company_id);

-- 3. Change role_permissions.role from enum to text
ALTER TABLE public.role_permissions ALTER COLUMN role TYPE text USING role::text;

-- 4. Drop old has_app_role with CASCADE (will drop dependent RLS policies)
DROP FUNCTION IF EXISTS public.has_app_role(uuid, app_role) CASCADE;

-- 5. Recreate has_app_role with text parameter
CREATE OR REPLACE FUNCTION public.has_app_role(_user_id uuid, _role text)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 6. Recreate the RLS policy on user_roles that was dropped by CASCADE
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_app_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_app_role(auth.uid(), 'admin'));

-- 7. Helper functions
CREATE OR REPLACE FUNCTION public.seed_system_roles(target_company_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO custom_roles (company_id, name, description, color, icon, is_system) VALUES
    (target_company_id, 'admin', 'Full access to all resources. Cannot be modified.', 'primary', 'ShieldCheck', true),
    (target_company_id, 'production', 'Project managers, filing reps, and field staff.', 'blue', 'Shield', true),
    (target_company_id, 'accounting', 'Billing team. Access to invoices, collections, and financial data.', 'amber', 'Shield', true)
  ON CONFLICT (company_id, name) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_permissions_for_role(target_company_id uuid, role_name text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  resources text[] := ARRAY[
    'dashboard','projects','properties','proposals','invoices',
    'time_logs','emails','calendar','documents','clients',
    'settings','users','roles','reports','rfps'
  ];
  r text;
BEGIN
  FOREACH r IN ARRAY resources LOOP
    INSERT INTO role_permissions (company_id, role, resource, enabled, can_list, can_show, can_create, can_update, can_delete)
    VALUES (target_company_id, role_name, r, false, false, false, false, false, false)
    ON CONFLICT (company_id, role, resource) DO NOTHING;
  END LOOP;
END;
$$;
