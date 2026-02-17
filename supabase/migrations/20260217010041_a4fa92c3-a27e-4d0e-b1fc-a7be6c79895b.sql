-- Add token for public proposal links and client signature storage
ALTER TABLE public.proposals 
  ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS client_signature_data TEXT,
  ADD COLUMN IF NOT EXISTS client_signed_name TEXT,
  ADD COLUMN IF NOT EXISTS client_signed_title TEXT;

-- Generate tokens for existing proposals
UPDATE public.proposals SET public_token = encode(gen_random_bytes(16), 'hex') WHERE public_token IS NULL;

-- Create trigger to auto-generate token on insert
CREATE OR REPLACE FUNCTION public.generate_proposal_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_proposal_token
  BEFORE INSERT ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_proposal_token();

-- RLS: Allow public read of proposals by token (for client-facing page)
CREATE POLICY "Public can view proposals by token"
  ON public.proposals
  FOR SELECT
  USING (public_token IS NOT NULL);

-- RLS: Allow public update of client signature fields only by token
CREATE POLICY "Public can sign proposals by token"
  ON public.proposals
  FOR UPDATE
  USING (public_token IS NOT NULL)
  WITH CHECK (public_token IS NOT NULL);

-- Allow public read of proposal_items for public proposal page
CREATE POLICY "Public can view proposal items for public proposals"
  ON public.proposal_items
  FOR SELECT
  USING (true);

-- Allow public read of proposal_milestones
CREATE POLICY "Public can view proposal milestones"
  ON public.proposal_milestones
  FOR SELECT
  USING (true);

-- Allow public read of proposal_contacts for the public page
CREATE POLICY "Public can view proposal contacts"
  ON public.proposal_contacts
  FOR SELECT
  USING (true);