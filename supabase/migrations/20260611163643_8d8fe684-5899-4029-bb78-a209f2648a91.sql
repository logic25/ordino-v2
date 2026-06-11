
-- 1. Scope user_roles admin policies to same company
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view company roles" ON public.user_roles;

CREATE POLICY "Admins can view company roles"
ON public.user_roles
FOR SELECT
USING (
  company_id = public.current_user_company_id()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND ur.company_id = public.user_roles.company_id
  )
);

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (
  company_id = public.current_user_company_id()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND ur.company_id = public.user_roles.company_id
  )
)
WITH CHECK (
  company_id = public.current_user_company_id()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND ur.company_id = public.user_roles.company_id
  )
);

-- 2. Tighten realtime: remove public:% wildcard, require company-scoped topic
DROP POLICY IF EXISTS "Authenticated users can subscribe to scoped topics" ON realtime.messages;

CREATE POLICY "Authenticated users can subscribe to scoped topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    -- Own user id embedded in topic
    POSITION((auth.uid())::text IN realtime.topic()) > 0
    -- Or the user's own company id embedded in topic
    OR (
      public.current_user_company_id() IS NOT NULL
      AND POSITION((public.current_user_company_id())::text IN realtime.topic()) > 0
    )
  )
);
