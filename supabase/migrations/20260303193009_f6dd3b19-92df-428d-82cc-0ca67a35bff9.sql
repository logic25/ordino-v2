
-- Add submitted_by column to rfps
ALTER TABLE public.rfps ADD COLUMN submitted_by uuid REFERENCES public.profiles(id);

-- Set created_by on existing RFPs that don't have it (backfill is optional, skip)

-- Make sure useCreateRfp will populate created_by going forward
