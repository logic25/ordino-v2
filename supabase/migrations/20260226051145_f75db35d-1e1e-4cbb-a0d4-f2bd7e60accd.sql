-- Fix existing universal_documents records with wrong storage_path for signed proposals
UPDATE public.universal_documents
SET 
  storage_path = REGEXP_REPLACE(storage_path, '^(proposals/[^/]+)/signed$', '\1/signed_proposal.html'),
  mime_type = 'text/html',
  filename = REGEXP_REPLACE(filename, '_signed\.pdf$', '_signed.html')
WHERE category = 'contract'
  AND storage_path ~ '^proposals/[^/]+/signed$';