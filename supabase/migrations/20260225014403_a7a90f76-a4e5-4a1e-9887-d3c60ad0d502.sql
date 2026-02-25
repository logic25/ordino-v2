CREATE TABLE public.widget_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_widget_messages_email_time ON public.widget_messages(user_email, created_at DESC);

ALTER TABLE public.widget_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages" ON public.widget_messages
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);