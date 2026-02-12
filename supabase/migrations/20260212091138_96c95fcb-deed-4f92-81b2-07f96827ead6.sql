
-- Add missing fields to proposals table
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS lead_source varchar DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS project_type varchar DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sales_person_id uuid DEFAULT NULL REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT NULL REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS billed_to_name varchar DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS billed_to_email varchar DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reminder_date date DEFAULT NULL;
