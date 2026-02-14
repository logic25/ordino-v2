
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_extension varchar,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS signature_data text;
