INSERT INTO public.changelog_entries (company_id, title, description, tag)
SELECT id, 'Upload your company logo from the RFP Content Library',
'You can now upload your company logo directly on the Company tab of the RFP Content Library. Uploaded logos are automatically included as attachments on outgoing RFP responses.',
'improvement'
FROM public.companies;