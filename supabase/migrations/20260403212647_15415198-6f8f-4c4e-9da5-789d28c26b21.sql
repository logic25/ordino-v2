-- Add OOO columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ooo_from date,
  ADD COLUMN IF NOT EXISTS ooo_to date,
  ADD COLUMN IF NOT EXISTS ooo_covering_pm_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS ooo_note text;