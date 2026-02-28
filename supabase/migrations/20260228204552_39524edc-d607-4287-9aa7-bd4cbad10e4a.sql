ALTER TABLE public.services ADD COLUMN IF NOT EXISTS billed_amount numeric DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS cost_amount numeric DEFAULT 0;