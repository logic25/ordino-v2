-- Add IN_PERSON to source enum
ALTER TYPE public.bd_lead_source_type ADD VALUE IF NOT EXISTS 'IN_PERSON';

-- Create lead_kind enum
DO $$ BEGIN
  CREATE TYPE public.lead_kind AS ENUM ('PROSPECT', 'CONTACT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add columns to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_kind public.lead_kind NOT NULL DEFAULT 'PROSPECT',
  ADD COLUMN IF NOT EXISTS lost_reason text;