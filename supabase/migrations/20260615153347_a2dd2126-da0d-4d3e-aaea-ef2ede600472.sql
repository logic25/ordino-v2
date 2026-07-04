-- Extend app_role enum to cover manager + pm
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pm';

-- Update trigger function to mirror all five active roles into user_roles
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role::text IN ('admin','manager','pm','production','accounting') THEN
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (NEW.user_id, NEW.role::text::app_role, NEW.company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.user_id
      AND company_id = NEW.company_id
      AND role::text <> NEW.role::text
      AND role::text IN ('admin','manager','pm','production','accounting');
  END IF;

  RETURN NEW;
END;
$function$;