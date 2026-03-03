ALTER TABLE public.billing_schedules 
  ADD COLUMN IF NOT EXISTS auto_send boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_method text;