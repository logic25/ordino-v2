-- Fix the trigger that uses gen_random_bytes which doesn't exist
CREATE OR REPLACE FUNCTION public.generate_proposal_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := replace(gen_random_uuid()::text, '-', '');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix any existing proposals that still have NULL tokens
UPDATE public.proposals SET public_token = replace(gen_random_uuid()::text, '-', '') WHERE public_token IS NULL;
