-- Add billed_at and estimated_bill_date columns to services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS billed_at timestamptz;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS estimated_bill_date date;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS assigned_to_name text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS parent_service_id uuid REFERENCES public.services(id);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS disciplines text[];
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS job_description text;