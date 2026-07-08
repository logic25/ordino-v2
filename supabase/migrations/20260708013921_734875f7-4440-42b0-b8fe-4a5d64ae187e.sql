INSERT INTO public.changelog_entries (company_id, title, description, tag)
SELECT id,
       'Client portal invite sign-in',
       'Client portal invites now point clients to a dedicated passwordless sign-in page instead of the staff Google sign-in screen.',
       'Improvement'
FROM public.companies
ON CONFLICT DO NOTHING;