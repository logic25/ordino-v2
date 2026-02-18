
-- Step 1: Add 'executed' to the proposal_status enum
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'executed';
