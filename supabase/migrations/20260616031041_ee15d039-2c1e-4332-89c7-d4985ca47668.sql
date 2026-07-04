
CREATE TABLE public.bd_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  photo_url TEXT,
  cover_url TEXT,
  logo_cfg JSONB NOT NULL DEFAULT '{"height":18,"width":224,"top":12,"right":16}'::jsonb,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bd_cards_user_id_idx ON public.bd_cards(user_id);
CREATE INDEX bd_cards_slug_idx ON public.bd_cards(slug);

GRANT SELECT ON public.bd_cards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_cards TO authenticated;
GRANT ALL ON public.bd_cards TO service_role;

ALTER TABLE public.bd_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published bd_cards"
  ON public.bd_cards FOR SELECT
  USING (published = true);

CREATE POLICY "Owners can view their bd_card"
  ON public.bd_cards FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners can insert their bd_card"
  ON public.bd_cards FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can update their bd_card"
  ON public.bd_cards FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can delete their bd_card"
  ON public.bd_cards FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_bd_cards_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER bd_cards_set_updated_at
  BEFORE UPDATE ON public.bd_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_bd_cards_updated_at();
