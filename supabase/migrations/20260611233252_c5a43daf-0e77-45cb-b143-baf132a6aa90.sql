
-- Helper that bypasses RLS to check whether a user has a given role
CREATE OR REPLACE FUNCTION public.user_has_app_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Replace the recursive policies on public.user_roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view company roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can view company roles"
ON public.user_roles
FOR SELECT
USING (
  company_id = public.current_user_company_id()
  AND public.user_has_app_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (
  company_id = public.current_user_company_id()
  AND public.user_has_app_role(auth.uid(), 'admin')
)
WITH CHECK (
  company_id = public.current_user_company_id()
  AND public.user_has_app_role(auth.uid(), 'admin')
);
