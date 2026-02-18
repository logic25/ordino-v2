
-- Notification preferences on profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{}';

-- Feature requests table
CREATE TABLE public.feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text DEFAULT 'general',
  priority text DEFAULT 'medium',
  status text DEFAULT 'submitted',
  upvotes integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company requests"
  ON public.feature_requests FOR SELECT
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can create requests"
  ON public.feature_requests FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update own requests"
  ON public.feature_requests FOR UPDATE
  USING (user_id = auth.uid());
