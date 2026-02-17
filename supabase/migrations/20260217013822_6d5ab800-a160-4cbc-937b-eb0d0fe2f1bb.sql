-- Add missing columns to proposal_items
ALTER TABLE public.proposal_items 
  ADD COLUMN IF NOT EXISTS fee_type text DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS estimated_hours numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_optional boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS disciplines text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discipline_fee numeric DEFAULT 0;