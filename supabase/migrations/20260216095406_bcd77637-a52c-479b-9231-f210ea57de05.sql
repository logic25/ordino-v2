-- Add retainer amount to proposals
ALTER TABLE public.proposals 
  ADD COLUMN IF NOT EXISTS retainer_amount numeric DEFAULT 0;