
-- ========================================
-- Company-level new fields
-- ========================================
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lead_owner_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS fax varchar,
  ADD COLUMN IF NOT EXISTS tax_id varchar,
  ADD COLUMN IF NOT EXISTS ibm_number varchar,
  ADD COLUMN IF NOT EXISTS ibm_number_expiration date,
  ADD COLUMN IF NOT EXISTS hic_license varchar,
  ADD COLUMN IF NOT EXISTS dob_tracking varchar,
  ADD COLUMN IF NOT EXISTS dob_tracking_expiration date,
  ADD COLUMN IF NOT EXISTS is_sia boolean NOT NULL DEFAULT false;

-- ========================================
-- Contact-level: split name into first/last, add address/mobile/fax fields
-- ========================================
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS first_name varchar,
  ADD COLUMN IF NOT EXISTS last_name varchar,
  ADD COLUMN IF NOT EXISTS mobile varchar,
  ADD COLUMN IF NOT EXISTS fax varchar,
  ADD COLUMN IF NOT EXISTS company_name varchar,
  ADD COLUMN IF NOT EXISTS lead_owner_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS address_1 varchar,
  ADD COLUMN IF NOT EXISTS address_2 varchar,
  ADD COLUMN IF NOT EXISTS city varchar,
  ADD COLUMN IF NOT EXISTS state varchar,
  ADD COLUMN IF NOT EXISTS zip varchar;

-- Migrate existing name data to first/last name
UPDATE public.client_contacts
SET
  first_name = SPLIT_PART(name, ' ', 1),
  last_name = CASE
    WHEN POSITION(' ' IN name) > 0 THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
    ELSE NULL
  END
WHERE first_name IS NULL;
