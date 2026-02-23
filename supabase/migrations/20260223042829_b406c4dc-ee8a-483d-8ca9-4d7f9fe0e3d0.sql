
-- Table 1: Hidden chat spaces
CREATE TABLE public.hidden_chat_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id text NOT NULL,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, space_id)
);

ALTER TABLE public.hidden_chat_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own hidden spaces"
  ON public.hidden_chat_spaces
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Table 2: Ordino assistant conversations
CREATE TABLE public.ordino_assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  context_type text,
  context_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ordino_assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own conversations"
  ON public.ordino_assistant_conversations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ordino_assistant_user
  ON public.ordino_assistant_conversations(user_id, created_at DESC);
