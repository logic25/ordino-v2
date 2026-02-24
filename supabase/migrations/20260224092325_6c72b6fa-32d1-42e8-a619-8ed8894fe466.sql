
-- content_candidates table
CREATE TABLE public.content_candidates (
  id text PRIMARY KEY,
  title text NOT NULL,
  content_type text DEFAULT 'blog_post',
  priority text DEFAULT 'medium',
  status text DEFAULT 'pending',
  relevance_score integer DEFAULT 50,
  demand_score integer,
  expertise_score integer,
  search_interest text DEFAULT 'unknown',
  affects_services jsonb DEFAULT '[]',
  key_topics jsonb DEFAULT '[]',
  reasoning text DEFAULT '',
  review_question text,
  content_angle text,
  team_questions_count integer DEFAULT 0,
  team_questions jsonb DEFAULT '[]',
  most_common_angle text,
  source_type text DEFAULT 'question_cluster',
  source_url text,
  source_email_id text,
  content_preview text,
  recommended_format text,
  estimated_minutes integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.content_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on content_candidates"
  ON public.content_candidates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- generated_content table
CREATE TABLE public.generated_content (
  id text PRIMARY KEY,
  candidate_id text REFERENCES public.content_candidates(id),
  content_type text DEFAULT 'blog_post',
  title text,
  content text,
  word_count integer DEFAULT 0,
  status text DEFAULT 'draft',
  generated_at timestamptz DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  published_at timestamptz,
  published_url text
);

ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on generated_content"
  ON public.generated_content
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
