
-- Add party info columns to leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS architect_name text,
  ADD COLUMN IF NOT EXISTS architect_company text,
  ADD COLUMN IF NOT EXISTS architect_phone text,
  ADD COLUMN IF NOT EXISTS architect_email text,
  ADD COLUMN IF NOT EXISTS architect_license_type text,
  ADD COLUMN IF NOT EXISTS architect_license_number text,
  ADD COLUMN IF NOT EXISTS gc_name text,
  ADD COLUMN IF NOT EXISTS gc_company text,
  ADD COLUMN IF NOT EXISTS gc_phone text,
  ADD COLUMN IF NOT EXISTS gc_email text,
  ADD COLUMN IF NOT EXISTS sia_name text,
  ADD COLUMN IF NOT EXISTS sia_company text,
  ADD COLUMN IF NOT EXISTS sia_phone text,
  ADD COLUMN IF NOT EXISTS sia_email text,
  ADD COLUMN IF NOT EXISTS tpp_name text,
  ADD COLUMN IF NOT EXISTS tpp_email text,
  ADD COLUMN IF NOT EXISTS drawings_uploaded boolean DEFAULT false;

-- Add party info columns to proposals table  
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS architect_name text,
  ADD COLUMN IF NOT EXISTS architect_company text,
  ADD COLUMN IF NOT EXISTS architect_phone text,
  ADD COLUMN IF NOT EXISTS architect_email text,
  ADD COLUMN IF NOT EXISTS architect_license_type text,
  ADD COLUMN IF NOT EXISTS architect_license_number text,
  ADD COLUMN IF NOT EXISTS gc_name text,
  ADD COLUMN IF NOT EXISTS gc_company text,
  ADD COLUMN IF NOT EXISTS gc_phone text,
  ADD COLUMN IF NOT EXISTS gc_email text,
  ADD COLUMN IF NOT EXISTS sia_name text,
  ADD COLUMN IF NOT EXISTS sia_company text,
  ADD COLUMN IF NOT EXISTS sia_phone text,
  ADD COLUMN IF NOT EXISTS sia_email text,
  ADD COLUMN IF NOT EXISTS tpp_name text,
  ADD COLUMN IF NOT EXISTS tpp_email text,
  ADD COLUMN IF NOT EXISTS drawings_storage_paths text[];
