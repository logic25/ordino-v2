
-- Add public_token column to change_orders for client-facing signing links
ALTER TABLE public.change_orders ADD COLUMN IF NOT EXISTS public_token text;

-- Create unique index on public_token
CREATE UNIQUE INDEX IF NOT EXISTS change_orders_public_token_unique ON public.change_orders (public_token) WHERE public_token IS NOT NULL;

-- Auto-generate public_token on insert
CREATE OR REPLACE FUNCTION public.generate_co_public_token()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := replace(gen_random_uuid()::text, '-', '');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_generate_co_public_token
  BEFORE INSERT ON public.change_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_co_public_token();

-- Backfill existing rows
UPDATE public.change_orders SET public_token = replace(gen_random_uuid()::text, '-', '') WHERE public_token IS NULL;

-- Allow anonymous read access for client-facing page (by public_token only)
CREATE POLICY "Public can read CO by token" ON public.change_orders
  FOR SELECT
  TO anon
  USING (public_token IS NOT NULL);
