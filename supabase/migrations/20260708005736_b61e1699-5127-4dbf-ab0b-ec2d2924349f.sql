
-- Flip default portal_role to 'client' (safer default)
ALTER TABLE public.profiles ALTER COLUMN portal_role SET DEFAULT 'client'::portal_role;

-- Explicitly mark all @greenlightexpediting.com users as gle_staff
UPDATE public.profiles p
SET portal_role = 'gle_staff'
FROM auth.users u
WHERE p.user_id = u.id
  AND lower(u.email) LIKE '%@greenlightexpediting.com'
  AND (p.portal_role IS NULL OR p.portal_role <> 'gle_staff');

-- Any remaining NULLs become 'client' (safe default)
UPDATE public.profiles SET portal_role = 'client' WHERE portal_role IS NULL;

-- Trigger: when a new auth user is created with a GLE email that is already confirmed,
-- ensure their profile is marked gle_staff. Otherwise defaults to 'client'.
CREATE OR REPLACE FUNCTION public.mark_gle_staff_on_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(split_part(NEW.email, '@', 2)) = 'greenlightexpediting.com' THEN
    UPDATE public.profiles
    SET portal_role = 'gle_staff'
    WHERE user_id = NEW.id AND portal_role IS DISTINCT FROM 'gle_staff';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed_mark_gle ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_mark_gle
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.mark_gle_staff_on_confirm();
