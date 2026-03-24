ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS citisignal_property_id text,
  ADD COLUMN IF NOT EXISTS vacate_order boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vacate_type text,
  ADD COLUMN IF NOT EXISTS co_status text,
  ADD COLUMN IF NOT EXISTS bis_profile_data jsonb;