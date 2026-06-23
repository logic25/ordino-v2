INSERT INTO public.changelog_entries (company_id, title, description, tag)
SELECT id,
  'Beacon filing guides now show in the right folder',
  'Knowledge Base files now use Beacon metadata folders, so moved filing guides such as Spring Valley appear under the selected jurisdiction folder instead of looking empty.',
  'fix'
FROM public.companies;
