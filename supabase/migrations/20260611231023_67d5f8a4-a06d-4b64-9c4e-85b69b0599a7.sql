INSERT INTO public.user_roles (user_id, role, company_id)
SELECT p.user_id, 'admin', p.company_id
FROM public.profiles p
WHERE p.role = 'admin'
  AND p.company_id IS NOT NULL
  AND p.user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.user_id AND ur.role = 'admin'
  );

CREATE OR REPLACE FUNCTION public.sync_profile_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin' AND NEW.company_id IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (NEW.user_id, 'admin', NEW.company_id)
    ON CONFLICT DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role <> 'admin' AND NEW.user_id IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_admin_role_trigger ON public.profiles;
CREATE TRIGGER sync_profile_admin_role_trigger
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_admin_role();