
UPDATE public.profiles SET role = 'pm'::user_role WHERE role = 'production'::user_role;

UPDATE public.profiles
SET role = 'manager'::user_role
WHERE user_id = 'ba281190-dcaa-4a6a-b3bc-c33a6a7e6e16';

DELETE FROM public.user_roles WHERE role = 'production';

INSERT INTO public.user_roles (user_id, role, company_id)
SELECT p.user_id, p.role::text, p.company_id
FROM public.profiles p
WHERE p.role::text IN ('admin','manager','pm','accounting')
ON CONFLICT (user_id, role, company_id) DO NOTHING;
