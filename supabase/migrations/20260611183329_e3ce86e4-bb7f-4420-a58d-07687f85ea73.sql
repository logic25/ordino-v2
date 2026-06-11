INSERT INTO public.changelog_entries (company_id, date, title, description, tag)
VALUES (
  '01993413-d3e8-4377-9e21-70f270f04487',
  CURRENT_DATE,
  'Ready to Invoice is now one worklist',
  'Billing → Ready to Invoice combines PM submissions, drafts, and ready-to-send invoices into a single oldest-first list with a status chip and one next-step action per row. Filter chips (All / Submissions / Ready / Drafts) replace the three stacked tables.',
  'improvement'
);