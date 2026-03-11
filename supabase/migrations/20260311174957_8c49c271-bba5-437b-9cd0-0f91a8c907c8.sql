ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS client_signer_name text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS client_signer_title text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS client_signature_data text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS client_signed_at timestamptz;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS client_ip_address text;