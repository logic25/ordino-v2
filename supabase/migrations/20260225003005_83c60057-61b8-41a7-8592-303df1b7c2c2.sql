
CREATE TABLE IF NOT EXISTS public.pinned_chat_spaces (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, space_id)
);

ALTER TABLE public.pinned_chat_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pins"
  ON public.pinned_chat_spaces
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
