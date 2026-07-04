CREATE OR REPLACE FUNCTION public.can_modify_operations(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND company_id = target_company_id
      AND role IN ('admin', 'manager', 'production', 'pm')
      AND is_active = true
  )
$function$;

INSERT INTO public.changelog_entries (company_id, title, description, tag)
SELECT id, 'PMs can now create and edit proposals', 'Fixed an RLS gap where Project Managers were blocked from creating or editing proposals, change orders, and other operations records.', 'fix'
FROM public.companies;