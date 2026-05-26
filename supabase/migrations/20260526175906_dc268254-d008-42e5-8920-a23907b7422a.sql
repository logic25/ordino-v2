ALTER TABLE public.rfp_response_drafts
ADD COLUMN IF NOT EXISTS include_logo boolean NOT NULL DEFAULT true;