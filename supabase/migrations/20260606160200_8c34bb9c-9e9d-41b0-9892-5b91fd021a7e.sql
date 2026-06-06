-- BD Sprint 2 — changelog entry, one per tenant company.
INSERT INTO public.changelog_entries (company_id, date, title, description, tag)
SELECT
  c.id,
  CURRENT_DATE,
  'BD Leads module',
  'New Leads workspace: an Airtable-style grid with saved views, filters, bulk '
    || 'actions and inline editing; a unified capture modal for every lead source; '
    || 'a lead detail page with an activity thread (notes, calls, meetings); and '
    || 'one-click "Create Proposal" that turns a qualified lead into a Company and proposal.',
  'feature'
FROM public.companies c;
