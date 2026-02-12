
-- Internal reviews table for rating companies and contacts
CREATE TABLE public.company_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_reviews ENABLE ROW LEVEL SECURITY;

-- Company members can view reviews
CREATE POLICY "Company isolation for reviews"
  ON public.company_reviews
  FOR SELECT
  USING (is_company_member(company_id));

-- Company members can create reviews
CREATE POLICY "Company members can create reviews"
  ON public.company_reviews
  FOR INSERT
  WITH CHECK (is_company_member(company_id));

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
  ON public.company_reviews
  FOR UPDATE
  USING (reviewer_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid() LIMIT 1));

-- Users can delete their own reviews, admins can delete any
CREATE POLICY "Users can delete own reviews or admin"
  ON public.company_reviews
  FOR DELETE
  USING (
    reviewer_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid() LIMIT 1)
    OR is_admin_or_manager(company_id)
  );

-- Index for fast lookups
CREATE INDEX idx_company_reviews_client_id ON public.company_reviews(client_id);
CREATE INDEX idx_company_reviews_contact_id ON public.company_reviews(contact_id);
