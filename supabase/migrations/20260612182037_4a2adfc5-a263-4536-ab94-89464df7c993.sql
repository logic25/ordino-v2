
ALTER TABLE public.universal_documents
  ADD COLUMN IF NOT EXISTS jurisdiction text NOT NULL DEFAULT 'NYC';

ALTER TABLE public.document_folders
  ADD COLUMN IF NOT EXISTS default_jurisdiction text NOT NULL DEFAULT 'NYC';

UPDATE public.universal_documents
  SET jurisdiction = 'NYC'
  WHERE jurisdiction IS NULL OR jurisdiction = '';
