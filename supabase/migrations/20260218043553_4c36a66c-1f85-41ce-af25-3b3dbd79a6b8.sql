
-- Add unit_number (apt/unit) to proposals table
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS unit_number text;
