
ALTER TABLE public.rfps ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.rfps ADD COLUMN IF NOT EXISTS insurance_requirements jsonb;
