
-- Add SIA and TPP party columns to projects table
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS sia_name text,
  ADD COLUMN IF NOT EXISTS sia_company text,
  ADD COLUMN IF NOT EXISTS sia_phone text,
  ADD COLUMN IF NOT EXISTS sia_email text,
  ADD COLUMN IF NOT EXISTS sia_number text,
  ADD COLUMN IF NOT EXISTS sia_nys_lic text,
  ADD COLUMN IF NOT EXISTS tpp_name text,
  ADD COLUMN IF NOT EXISTS tpp_email text,
  ADD COLUMN IF NOT EXISTS architect_license_type text,
  ADD COLUMN IF NOT EXISTS architect_license_number text;
