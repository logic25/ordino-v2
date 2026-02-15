
-- Add recommended companies column to discovered_rfps
ALTER TABLE public.discovered_rfps 
ADD COLUMN recommended_company_ids uuid[] DEFAULT '{}';

-- Add index for querying by recommended companies
CREATE INDEX idx_discovered_rfps_recommended ON public.discovered_rfps USING GIN(recommended_company_ids);
