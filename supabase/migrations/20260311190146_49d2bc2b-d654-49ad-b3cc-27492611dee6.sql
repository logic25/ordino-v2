
CREATE TABLE public.bug_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id uuid NOT NULL REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bug_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can read bug comments"
  ON public.bug_comments FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Company members can insert bug comments"
  ON public.bug_comments FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
