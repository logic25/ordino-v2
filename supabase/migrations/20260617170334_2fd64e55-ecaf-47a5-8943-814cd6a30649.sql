INSERT INTO public.changelog_entries (company_id, date, title, description, tag)
SELECT id, CURRENT_DATE, 'KB editor protects unsaved edits',
       'Editing a Filing Guide or other Knowledge Base document no longer closes when you click outside. If you press Escape with unsaved changes, you''ll be asked to confirm before discarding.',
       'fix'
FROM public.companies;