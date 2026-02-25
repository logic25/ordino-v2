
-- Create action_item_comments table
CREATE TABLE public.action_item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_item_id uuid REFERENCES public.project_action_items(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  company_id uuid REFERENCES public.companies(id) NOT NULL,
  content text,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast lookups
CREATE INDEX idx_action_item_comments_item ON public.action_item_comments(action_item_id, created_at);

-- Enable RLS
ALTER TABLE public.action_item_comments ENABLE ROW LEVEL SECURITY;

-- RLS: same-company members can read comments
CREATE POLICY "Company members can read comments"
  ON public.action_item_comments FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

-- RLS: same-company members can insert comments
CREATE POLICY "Company members can insert comments"
  ON public.action_item_comments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_member(company_id));

-- RLS: users can update their own comments
CREATE POLICY "Users can update own comments"
  ON public.action_item_comments FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));

-- RLS: users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON public.action_item_comments FOR DELETE
  TO authenticated
  USING (user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.action_item_comments;
