INSERT INTO public.changelog_entries (company_id, date, title, description, tag)
SELECT id, CURRENT_DATE, 'Reports access tightened', 'Referrals, Data Exports, and CitiSignal tabs in Reports are now visible to admins only. All other report tabs remain available to everyone.', 'improvement'
FROM public.companies;