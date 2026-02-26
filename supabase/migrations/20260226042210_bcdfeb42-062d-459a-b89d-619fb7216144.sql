ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS deposit_percentage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz;