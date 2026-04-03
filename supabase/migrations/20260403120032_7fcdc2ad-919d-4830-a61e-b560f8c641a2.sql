-- Add created_by column to properties
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- Backfill from signal_subscriptions enrolled_by where available
UPDATE public.properties p
SET created_by = ss.enrolled_by
FROM public.signal_subscriptions ss
WHERE ss.property_id = p.id
  AND p.created_by IS NULL
  AND ss.enrolled_by IS NOT NULL;