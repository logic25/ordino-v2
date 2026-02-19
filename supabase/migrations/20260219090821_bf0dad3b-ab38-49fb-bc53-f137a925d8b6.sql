-- Add phase tracking to projects
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'pre_filing';

-- Add comment for documentation
COMMENT ON COLUMN public.projects.phase IS 'Project lifecycle phase: pre_filing, filing, approval, closeout';