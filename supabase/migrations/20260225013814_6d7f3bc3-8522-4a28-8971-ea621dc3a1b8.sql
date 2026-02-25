CREATE TABLE public.chat_space_nicknames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, space_id)
);

ALTER TABLE public.chat_space_nicknames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own nicknames" ON public.chat_space_nicknames
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);