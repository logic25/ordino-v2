-- Fix search_path on generate_proposal_token
CREATE OR REPLACE FUNCTION public.generate_proposal_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := replace(gen_random_uuid()::text, '-', '');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;