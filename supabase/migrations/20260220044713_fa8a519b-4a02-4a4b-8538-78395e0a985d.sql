
-- Create telemetry_events table
CREATE TABLE public.telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid,
  session_id text,
  page text NOT NULL,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own events
CREATE POLICY "Users can insert telemetry events"
ON public.telemetry_events
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Only admins (company members with admin role) can read telemetry
CREATE POLICY "Admins can read telemetry events"
ON public.telemetry_events
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));

-- Create ai_roadmap_suggestions table
CREATE TABLE public.ai_roadmap_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text DEFAULT 'general',
  priority text DEFAULT 'medium',
  evidence text,
  duplicate_warning text,
  challenges text[],
  status text DEFAULT 'pending_review',
  source text DEFAULT 'telemetry',
  raw_idea text,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

ALTER TABLE public.ai_roadmap_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage ai roadmap suggestions"
ON public.ai_roadmap_suggestions
FOR ALL
TO authenticated
USING (public.is_company_member(company_id))
WITH CHECK (public.is_company_member(company_id));
