ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contact_address text;

INSERT INTO public.changelog_entries (company_id, date, title, description, tag)
SELECT id, CURRENT_DATE,
  'Lead detail: address field, clear follow-up, smart company suggestion',
  'Lead Identity now has a dedicated Address field for mailing/office addresses. The Next follow-up card has a Clear button to dismiss it. When a lead has a government-style Role (e.g. "Bronx Borough President") and Company is empty, Ordino suggests "Office of the [role]" with one-click apply.',
  'improvement'
FROM public.companies;